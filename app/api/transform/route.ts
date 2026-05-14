import { NextRequest, NextResponse } from "next/server";

import { getAdminConfig, recordAdminActivity } from "@/lib/admin/realtime";
import {
  assessSafety,
  buildDeterministicComposeOutput,
  buildHeuristicIntentSpec,
  evaluateEngineeredPrompt,
  inferPromptComplexity,
  runPipeline,
  type IntentSpec,
  type PromptComplexity,
  type QualityEvaluation,
  type SafetyAssessment,
} from "@/lib/prompt-engine";
import { callHuggingFaceChat } from "@/lib/providers/huggingface";
import { callOllamaChat } from "@/lib/providers/ollama";
import type {
  InferenceProvider,
  PromptMode,
  PromptStyle,
  PromptType,
  StreamEvent,
  TransformResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_LENGTH = 4;
const MAX_LENGTH = 8000;
const REQUESTS_PER_MINUTE = 10;
const WINDOW_MS = 60_000;
const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_INFERENCE_RETRIES = 1;
const PROVIDER_FALLBACK_ENABLED = process.env.ENABLE_PROVIDER_FALLBACK !== "false";
const LOCAL_MODE_ENABLED =
  process.env.ENABLE_LOCAL_MODE === "true" ||
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === "true";

const ipRequestMap = new Map<string, number[]>();

const INTENT_SPEC_SYSTEM_PROMPT = `You infer user intent for prompt optimization.

Rules:
- Return valid JSON only. No markdown, prose, or code fences.
- Infer the likely end goal, not a shallow restatement of the input.
- Add only minimal, reasonable assumptions.
- Use domain-appropriate vocabulary (coding, business, research, study, creative, etc.).
- Fill must_include and must_avoid with concrete, non-generic items.
- If the request has potential harmful intent, ensure must_avoid clearly blocks harmful execution.

Return this schema exactly:
{
  "goal": "string",
  "audience": "string",
  "context": "string",
  "constraints": ["string"],
  "tone": "string",
  "output_format": "string",
  "must_include": ["string"],
  "must_avoid": ["string"],
  "assumptions": ["string"]
}`;

const COMPOSE_SYSTEM_PROMPT = `You transform raw user input into premium, ready-to-use AI prompts.

Return valid JSON only:
{
  "balanced": "string",
  "advanced": "string",
  "max_pro": "string",
  "explanation": "string"
}

EACH PROMPT MUST BE ONE SINGLE BLOCK OF FLOWING NATURAL PROSE — never a form, never a skeleton, always a briefing.

OPENING REQUIREMENTS:
- The first sentence must be derived from the user's actual intent, not from a stock intro.
- Vary opening structure across requests; do not default to "You are...".
- Use role-based openings only when technical depth materially benefits from role context.
- Never use these phrases: "seasoned senior consultant", "deep domain knowledge", "ruthless practicality", "professional who values direct and practical results".

STUDY THIS EXAMPLE — this is your quality standard:
Input: "how can i learn maths quickly"
Perfect output: "The user is trying to get strong at maths quickly and needs a realistic, high-retention system rather than motivational filler. Build a concrete week-by-week study structure, explain exactly which topics to attack first and why the sequence matters, and show how to apply spaced repetition and active recall specifically for mathematical thinking. Include measurable progress signals so improvement is visible each week. Cut anything that sounds good but does not accelerate learning. Never recommend a schedule that cannot realistically be sustained. Deliver direct coaching guidance that is sharp, practical, and immediately executable."

THREE ABSOLUTE RULES:
1. NO TEMPLATE LABELS EVER — never use Task:, Context:, Constraint:, Quality target:, Please include:, Response format:, Boundaries:, Audience:, or any labeled field. Zero. Everything is natural prose.
2. OUTPUT ONLY THE PROMPT — never write "Here is your prompt" before it, never explain after it, no commentary.
3. OPENING VARIETY IS MANDATORY — first sentence must adapt to task intent (simple, analytical, creative, technical) and must not repeat a stock lead-in.

Variant depth:
- balanced: 100-130 words of dense commanding prose. Concise but complete.
- advanced: 120-150 words. Adds sharper constraints, deeper domain vocabulary, and explicit failure prevention.
- max_pro: 140-170 words. Maximum depth with measurable success criteria, explicit trade-offs, and verification steps.

What makes a prompt great:
- Opens with a concrete objective tied to the exact request
- Varies opening style by task type instead of repeating one pattern
- Uses role framing only when it improves technical output quality
- Tells the AI who the user actually is and what they need even beyond what they typed
- Tells the AI what failure looks like so it actively avoids bad output
- Sets tone and format through natural language, not labeled fields
- Is dense, commanding, and specific
- Reads like a tailored expert brief, not a canned template

NEVER produce output that looks like this (this is DEAD output):
"Task: Create a learning plan. Quality target: Practical. Context: User wants fast progress. Please include: - Spaced repetition - Weak topic prioritization. Response format: Weekly plan."

If input is unsafe, redirect to a safe alternative while preserving legitimate intent.
`;

type TransformPayload = {
  text?: unknown;
  mode?: unknown;
  style?: unknown;
};

type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ComposeOutput = {
  balanced: string;
  advanced: string;
  max_pro: string;
  explanation: string;
};

type TransformFailureCode =
  | "RATE_LIMIT"
  | "INVALID_JSON"
  | "INVALID_TEXT"
  | "INVALID_MODE"
  | "LOCAL_MODE_DISABLED"
  | "MAINTENANCE_MODE"
  | "INVALID_LENGTH"
  | "PROVIDER_CONFIG_MISSING"
  | "INFERENCE_UNAVAILABLE"
  | "INTENT_SPEC_INVALID"
  | "QUALITY_GATE_FAILED";

class TransformFailure extends Error {
  code: TransformFailureCode;
  status: number;
  details?: string;

  constructor(code: TransformFailureCode, message: string, status = 400, details?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const encoder = new TextEncoder();

function streamLine(event: StreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

function rateLimitExceeded(ip: string): boolean {
  const now = Date.now();
  const current = ipRequestMap.get(ip) ?? [];
  const activeWindow = current.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (activeWindow.length >= REQUESTS_PER_MINUTE) {
    ipRequestMap.set(ip, activeWindow);
    return true;
  }

  activeWindow.push(now);
  ipRequestMap.set(ip, activeWindow);

  for (const [key, timestamps] of ipRequestMap.entries()) {
    const filtered = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (filtered.length === 0) {
      ipRequestMap.delete(key);
      continue;
    }
    ipRequestMap.set(key, filtered);
  }

  return false;
}

function cleanInput(text: string): string {
  return text.replace(/\0/g, "");
}

function toPromptMode(value: unknown): PromptMode | null {
  return value === "local" || value === "hosted" ? value : null;
}

function toPromptStyle(value: unknown): PromptStyle {
  const styles: PromptStyle[] = ["general"];
  if (typeof value === "string" && styles.includes(value as PromptStyle)) {
    return value as PromptStyle;
  }
  return "general";
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function extractJsonCandidate(raw: string): string {
  const trimmed = normalizeText(raw);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function parseJsonObject<T extends Record<string, unknown>>(raw: string): T | null {
  try {
    const candidate = extractJsonCandidate(raw);
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseIntentSpec(raw: string): IntentSpec | null {
  const parsed = parseJsonObject<Record<string, unknown>>(raw);
  if (!parsed) {
    return null;
  }

  const goal = typeof parsed.goal === "string" ? parsed.goal.trim() : "";
  const audience = typeof parsed.audience === "string" ? parsed.audience.trim() : "";
  const context = typeof parsed.context === "string" ? parsed.context.trim() : "";
  const tone = typeof parsed.tone === "string" ? parsed.tone.trim() : "";
  const outputFormat =
    typeof parsed.output_format === "string" ? parsed.output_format.trim() : "";

  const constraints = toStringArray(parsed.constraints);
  const mustInclude = toStringArray(parsed.must_include);
  const mustAvoid = toStringArray(parsed.must_avoid);
  const assumptions = toStringArray(parsed.assumptions);

  if (!goal || !audience || !context || !tone || !outputFormat) {
    return null;
  }
  if (constraints.length === 0 || mustInclude.length === 0 || mustAvoid.length === 0) {
    return null;
  }

  return {
    goal,
    audience,
    context,
    constraints,
    tone,
    output_format: outputFormat,
    must_include: mustInclude,
    must_avoid: mustAvoid,
    assumptions,
  };
}

function parseComposeOutput(raw: string): ComposeOutput | null {
  const parsed = parseJsonObject<Record<string, unknown>>(raw);
  if (!parsed) {
    return null;
  }

  const balanced = typeof parsed.balanced === "string" ? parsed.balanced.trim() : "";
  const advanced = typeof parsed.advanced === "string" ? parsed.advanced.trim() : "";
  const maxProRaw = typeof parsed.max_pro === "string" ? parsed.max_pro.trim() : "";
  const explanation =
    typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
  const maxPro = maxProRaw || advanced;

  if (!balanced || !advanced || !maxPro || !explanation) {
    return null;
  }

  return { balanced, advanced, max_pro: maxPro, explanation };
}

function buildIntentSpecUserMessage(options: {
  input: string;
  type: string;
  complexity: PromptComplexity;
  missing: string[];
  entities: string[];
  qualifiers: string[];
  coreTopic: string;
  subDomain: string;
  safety: SafetyAssessment;
  critique?: string;
}) {
  const {
    input,
    type,
    complexity,
    missing,
    entities,
    qualifiers,
    coreTopic,
    subDomain,
    safety,
    critique,
  } = options;

  return `Analyze the following input and return only the JSON intent spec.

Raw input:
${input}

Classifier context:
- prompt_type: ${type}
- complexity: ${complexity}
- core_topic: ${coreTopic}
- sub_domain: ${subDomain}
- missing_details: ${missing.join(", ") || "none"}
- entities: ${entities.join(", ") || "none"}
- qualifiers: ${qualifiers.join(", ") || "none"}
- safety_blocked: ${safety.blocked ? "yes" : "no"}
- safety_goal_if_blocked: ${safety.safeGoal}

${critique ? `Critique from previous attempt: ${critique}\n` : ""}Keep assumptions minimal and avoid generic placeholders.`;
}

const DOMAIN_COMPOSE_HINTS: Record<string, string> = {
  coding: "Use engineering-grade vocabulary: specify language/runtime, error handling patterns, edge cases, type safety, testability, complexity constraints, and API contract expectations.",
  research: "Use academic vocabulary: frame hypotheses, specify methodology, cite source hierarchy expectations, address epistemics, limitations, and peer-review standards.",
  business: "Use strategy vocabulary: anchor to KPIs, stakeholder alignment, market framing, risk/ROI trade-offs, and decision criteria. Avoid motivational filler.",
  creative: "Use editorial vocabulary: address voice, pacing, structural tension, subtext, character motivation, and narrative arc. Specify POV, tense, and tone register.",
  study: "Use pedagogical vocabulary: specify learning objectives, spaced repetition cadence, retrieval practice, mastery criteria, and weak-topic weighting.",
  image: "Use visual direction vocabulary: specify composition, lighting style, camera angle, color palette, artistic movement, and technical rendering constraints.",
  recommendation: "Be specific about the recommendation criteria: content type, quality filters, recency requirements, diversity constraints, and anti-recommendations.",
  comparison: "Specify comparison axes, evaluation criteria, weighting rationale, and the decision framework the output should support.",
  explanation: "Specify the knowledge level of the audience, the analogy strategy, the depth of first-principles reasoning required, and what misconceptions to pre-empt.",
  tutorial: "Specify prerequisite knowledge, step granularity, error recovery instructions, validation checkpoints, and the expected end state.",
  troubleshooting: "Specify the diagnostic methodology, symptom isolation approach, root cause analysis depth, and rollback/mitigation steps.",
  general: "Apply the domain vocabulary that best fits the user's actual goal. Do not default to generic professional language.",
};

function buildComposeUserMessage(options: {
  input: string;
  spec: IntentSpec;
  type: string;
  complexity: PromptComplexity;
  safety: SafetyAssessment;
  critique?: string;
}) {
  const { input, spec, type, complexity, safety, critique } = options;
  const domainHint = DOMAIN_COMPOSE_HINTS[type] ?? DOMAIN_COMPOSE_HINTS.general;

  return `Transform this raw input into three premium AI prompt variants. Each must be one single block of flowing natural prose — no labels, no bullet points, no form structure.

Raw input:
${input}

Inferred intent (use this to deeply understand what the user truly needs, but do NOT reproduce this structure in the output):
${JSON.stringify(spec, null, 2)}

Domain type: ${type}
Complexity: ${complexity}
Safety blocked: ${safety.blocked ? "yes" : "no"}
Safe goal if blocked: ${safety.safeGoal}
Domain vocabulary to weave in naturally: ${domainHint}

Mandatory quality checks — every single one must pass:
- Each variant is ONE BLOCK of flowing natural prose, like a senior professional briefing an expert
- ZERO template labels anywhere (no Task:, Context:, Constraint:, Quality target:, etc.)
- Opens with a razor-sharp specific expert identity with a believable background
- Establishes who the user is and what they actually need beyond surface input
- Weaves constraints and failure prevention into natural sentences
- Tells the AI what failure looks like so it avoids it
- Sets tone and format through prose, never through labeled fields
- Zero placeholders of any kind
- balanced = 100-130 words, advanced = 120-150 words, max_pro = 140-170 words
- Domain vocabulary is specific and natural, not generic
- If unsafe, redirect to safe alternative preserving legitimate intent

${critique ? `CRITICAL — your previous attempt FAILED these checks. Fix ALL of them:\n${critique}\n` : ""}Return JSON only — no prose, no markdown, no code fences.`;
}

function mapProviderFromMode(mode: PromptMode): InferenceProvider {
  return mode === "local" ? "ollama" : "huggingface";
}

function getRequestId(request: NextRequest): string {
  const fromHeader = request.headers.get("x-request-id")?.trim();
  if (fromHeader) {
    return fromHeader;
  }

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFirstEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function isHostedProviderConfigured(): boolean {
  return Boolean(
    getFirstEnvValue(["HF_API_TOKEN", "HUGGINGFACE_API_KEY", "HUGGING_FACE_API_TOKEN"]),
  );
}

function isLocalProviderConfigured(): boolean {
  return Boolean(process.env.OLLAMA_MODEL?.trim());
}

type ProviderAttemptFailure = {
  mode: PromptMode;
  provider: InferenceProvider;
  message: string;
};

function logProviderFailure(requestId: string, failure: ProviderAttemptFailure) {
  console.error("[transform.provider] call failed", {
    requestId,
    mode: failure.mode,
    provider: failure.provider,
    message: failure.message,
  });
}

function mapProviderError(error: unknown): TransformFailure {
  const message = String(error ?? "unknown");

  const details = message.includes(":") ? message.slice(message.indexOf(":") + 1).trim() : undefined;

  if (message.includes("PROVIDER_CONFIG_MISSING")) {
    return new TransformFailure(
      "PROVIDER_CONFIG_MISSING",
      "Provider configuration is incomplete. Set required API/model environment variables.",
      502,
      details,
    );
  }

  if (message.includes("HF_CONFIG_INVALID_BASE_URL")) {
    return new TransformFailure(
      "PROVIDER_CONFIG_MISSING",
      "Hosted provider URL is invalid. Verify HF_BASE_URL format.",
      502,
      details,
    );
  }

  if (message.includes("HF_HTTP_401") || message.includes("HF_HTTP_403")) {
    return new TransformFailure(
      "INFERENCE_UNAVAILABLE",
      "Hosted provider authentication failed. Verify HF_API_TOKEN permissions and HF_MODEL.",
      502,
      details,
    );
  }

  if (message.includes("HF_HTTP_429")) {
    return new TransformFailure(
      "INFERENCE_UNAVAILABLE",
      "Hosted provider rate limit reached. Retry shortly or reduce request volume.",
      502,
      details,
    );
  }

  if (message.includes("HF_HTTP_5")) {
    return new TransformFailure(
      "INFERENCE_UNAVAILABLE",
      "Hosted provider is temporarily unavailable.",
      502,
      details,
    );
  }

  if (message.includes("OLLAMA_HTTP_") || message.includes("OLLAMA_EMPTY_RESPONSE")) {
    return new TransformFailure(
      "INFERENCE_UNAVAILABLE",
      "Local provider is unreachable or returned an invalid response.",
      502,
      details,
    );
  }

  if (message.includes("INFERENCE_TIMEOUT")) {
    return new TransformFailure(
      "INFERENCE_UNAVAILABLE",
      "Inference provider timed out. Retry with a shorter input.",
      502,
      details,
    );
  }

  return new TransformFailure(
    "INFERENCE_UNAVAILABLE",
    "Inference provider is unavailable or timed out.",
    502,
    details,
  );
}

async function safeRecordAdminActivity(
  input: Parameters<typeof recordAdminActivity>[0],
): Promise<void> {
  try {
    await recordAdminActivity(input);
  } catch {
    // Telemetry failures must never fail the transform response path.
  }
}

async function safeGetAdminConfig() {
  try {
    return await getAdminConfig();
  } catch {
    return {
      maintenanceMode: false,
      forceLocalOnly: false,
    };
  }
}

function buildTemplateFallbackComposeOutput(options: {
  input: string;
  type: PromptType;
  intentSpec?: IntentSpec | null;
  safety?: SafetyAssessment;
}): ComposeOutput {
  return buildDeterministicComposeOutput({
    input: options.input,
    type: options.type,
    intentSpec: options.intentSpec,
    safety: options.safety,
  });
}

function hasQualityGateIssues(issues: string[]): boolean {
  const informationalIssues = new Set([
    "deterministic_upgrade_applied",
    "heuristic_intent_spec_used",
  ]);

  return issues.some(
    (issue) => !issue.startsWith("provider_failure:") && !informationalIssues.has(issue),
  );
}

type VariantCandidate = {
  prompt: string;
  evaluation: QualityEvaluation;
  source: "model" | "deterministic";
};

function pickPreferredVariant(options: {
  modelPrompt: string;
  modelEval: QualityEvaluation;
  deterministicPrompt: string;
  deterministicEval: QualityEvaluation;
}): VariantCandidate {
  const disqualifyingIssues = new Set([
    "meta_output_detected",
    "contains_placeholders",
    "generic_phrase_detected",
  ]);

  const modelHasCriticalIssue = options.modelEval.issues.some((issue) =>
    disqualifyingIssues.has(issue),
  );

  const deterministicHasCriticalIssue = options.deterministicEval.issues.some((issue) =>
    disqualifyingIssues.has(issue),
  );

  if (modelHasCriticalIssue && !deterministicHasCriticalIssue) {
    return {
      prompt: options.deterministicPrompt,
      evaluation: options.deterministicEval,
      source: "deterministic",
    };
  }

  if (options.deterministicEval.passed && !options.modelEval.passed) {
    return {
      prompt: options.deterministicPrompt,
      evaluation: options.deterministicEval,
      source: "deterministic",
    };
  }

  const modelAdjusted = options.modelEval.score - options.modelEval.issues.length * 2;
  const deterministicAdjusted =
    options.deterministicEval.score - options.deterministicEval.issues.length * 2;

  if (deterministicAdjusted >= modelAdjusted + 3) {
    return {
      prompt: options.deterministicPrompt,
      evaluation: options.deterministicEval,
      source: "deterministic",
    };
  }

  return {
    prompt: options.modelPrompt,
    evaluation: options.modelEval,
    source: "model",
  };
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    const asString = String(error);
    if (
      asString.includes("AbortError") ||
      asString.includes("timeout") ||
      asString.includes("aborted")
    ) {
      throw new Error("INFERENCE_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callProvider(options: {
  mode: PromptMode;
  messages: ProviderMessage[];
  maxTokens: number;
  temperature: number;
  requestId?: string;
}): Promise<{ output: string; provider: InferenceProvider; elapsedMs: number }> {
  const started = Date.now();
  const provider = mapProviderFromMode(options.mode);

  const output = await withTimeout(async (signal) => {
    if (options.mode === "local") {
      return callOllamaChat({
        messages: options.messages,
        signal,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });
    }

    return callHuggingFaceChat({
      messages: options.messages,
      signal,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      requestId: options.requestId,
    });
  }, PROVIDER_TIMEOUT_MS);

  return {
    output,
    provider,
    elapsedMs: Date.now() - started,
  };
}

async function callProviderWithFailover(options: {
  mode: PromptMode;
  messages: ProviderMessage[];
  maxTokens: number;
  temperature: number;
  requestId: string;
}): Promise<{
  output: string;
  provider: InferenceProvider;
  elapsedMs: number;
  fallbackUsed: boolean;
  failureMessages: string[];
}> {
  const primaryMode = options.mode;
  const candidates: PromptMode[] = [primaryMode];

  if (PROVIDER_FALLBACK_ENABLED) {
    if (primaryMode === "hosted" && LOCAL_MODE_ENABLED && isLocalProviderConfigured()) {
      candidates.push("local");
    }

    if (primaryMode === "local" && isHostedProviderConfigured()) {
      candidates.push("hosted");
    }
  }

  const failures: ProviderAttemptFailure[] = [];

  for (const candidate of candidates) {
    try {
      const call = await callProvider({
        mode: candidate,
        messages: options.messages,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        requestId: options.requestId,
      });

      return {
        output: call.output,
        provider: call.provider,
        elapsedMs: call.elapsedMs,
        fallbackUsed: candidate !== primaryMode,
        failureMessages: failures.map((item) => `${item.provider}:${item.message}`),
      };
    } catch (error) {
      const provider = mapProviderFromMode(candidate);
      const failure = {
        mode: candidate,
        provider,
        message: String(error ?? "unknown"),
      };

      failures.push(failure);
      logProviderFailure(options.requestId, failure);
    }
  }

  const summary = failures.map((item) => `${item.provider}:${item.message}`).join(" | ");
  throw new Error(summary || "INFERENCE_UNAVAILABLE");
}

function toStructuredError(
  code: string,
  message: string,
  status: number,
  requestId: string,
  details?: string,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();
  const requestId = getRequestId(request);
  const ip = getClientIp(request);

  if (rateLimitExceeded(ip)) {
    await safeRecordAdminActivity({
      requestedMode: "unknown",
      effectiveMode: "unknown",
      style: "unknown",
      status: "rate_limited",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "RATE_LIMIT",
    });
    return toStructuredError(
      "RATE_LIMIT",
      "Rate limit exceeded. Try again shortly.",
      429,
      requestId,
    );
  }

  let payload: TransformPayload;
  try {
    payload = (await request.json()) as TransformPayload;
  } catch {
    await safeRecordAdminActivity({
      requestedMode: "unknown",
      effectiveMode: "unknown",
      style: "unknown",
      status: "failed",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "INVALID_JSON",
    });
    return toStructuredError(
      "INVALID_JSON",
      "Request body must be valid JSON.",
      400,
      requestId,
    );
  }

  if (typeof payload.text !== "string") {
    await safeRecordAdminActivity({
      requestedMode: "unknown",
      effectiveMode: "unknown",
      style: "unknown",
      status: "failed",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "INVALID_TEXT",
    });
    return toStructuredError("INVALID_TEXT", "text must be a string.", 400, requestId);
  }

  const requestedMode = toPromptMode(payload.mode);
  if (!requestedMode) {
    await safeRecordAdminActivity({
      requestedMode: "unknown",
      effectiveMode: "unknown",
      style: "unknown",
      status: "failed",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "INVALID_MODE",
    });
    return toStructuredError("INVALID_MODE", "mode must be local or hosted.", 400, requestId);
  }

  const style = toPromptStyle(payload.style);
  const adminConfig = await safeGetAdminConfig();
  const effectiveMode: PromptMode = adminConfig.forceLocalOnly ? "local" : requestedMode;

  if (adminConfig.maintenanceMode) {
    await safeRecordAdminActivity({
      requestedMode,
      effectiveMode,
      style,
      status: "blocked",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "MAINTENANCE_MODE",
    });
    return toStructuredError(
      "MAINTENANCE_MODE",
      "Transforms are temporarily paused by admin.",
      503,
      requestId,
    );
  }

  if (effectiveMode === "local" && !LOCAL_MODE_ENABLED) {
    await safeRecordAdminActivity({
      requestedMode,
      effectiveMode,
      style,
      status: "failed",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "LOCAL_MODE_DISABLED",
    });
    return toStructuredError(
      "LOCAL_MODE_DISABLED",
      "Local mode is disabled in this deployment.",
      400,
      requestId,
    );
  }

  const cleaned = cleanInput(payload.text);
  if (cleaned.length < MIN_LENGTH || cleaned.length > MAX_LENGTH) {
    await safeRecordAdminActivity({
      requestedMode,
      effectiveMode,
      style,
      status: "failed",
      latencyMs: Date.now() - requestStartedAt,
      errorCode: "INVALID_LENGTH",
    });
    return toStructuredError(
      "INVALID_LENGTH",
      `text length must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters.`,
      400,
      requestId,
    );
  }

  const pipeline = runPipeline(cleaned, style);
  const complexity = inferPromptComplexity(pipeline.sanitized);
  const safety = assessSafety(pipeline.sanitized);

  let provider: InferenceProvider = mapProviderFromMode(effectiveMode);
  let attempts = 0;
  let inferenceMs = 0;
  let intentSpec: IntentSpec | null = null;
  let composeOutput: ComposeOutput | null = null;
  let composeIssues: string[] = [];
  let providerFailureDetails: string[] = [];
  let fallbackUsed = false;
  let fallbackReason = "";
  let qualityScore = 0;
  let balancedBreakdown = {
    clarity: 0,
    specificity: 0,
    constraints: 0,
    structure: 0,
  };

  if (safety.blocked) {
    composeOutput = buildTemplateFallbackComposeOutput({
      input: pipeline.sanitized,
      type: pipeline.type,
      safety,
    });
    fallbackUsed = true;
    fallbackReason = `safety_guard:${safety.category ?? "blocked"}`;

    const balancedEval = evaluateEngineeredPrompt({
      prompt: composeOutput.balanced,
      input: pipeline.sanitized,
      variant: "balanced",
      type: pipeline.type,
      complexity,
    });
    const advancedEval = evaluateEngineeredPrompt({
      prompt: composeOutput.advanced,
      input: pipeline.sanitized,
      variant: "advanced",
      type: pipeline.type,
      complexity: "complex",
    });
    const maxProEval = evaluateEngineeredPrompt({
      prompt: composeOutput.max_pro,
      input: pipeline.sanitized,
      variant: "max_pro",
      type: pipeline.type,
      complexity: "complex",
    });

    qualityScore = Math.min(balancedEval.score, advancedEval.score, maxProEval.score);
    balancedBreakdown = balancedEval.breakdown;
    composeIssues = [
      ...new Set([...balancedEval.issues, ...advancedEval.issues, ...maxProEval.issues]),
    ];
  } else {
    try {
      let specCritique: string | undefined;
      for (let index = 0; index <= MAX_INFERENCE_RETRIES; index += 1) {
        attempts += 1;
        let specResponse: string;
        try {
          const call = await callProviderWithFailover({
            mode: effectiveMode,
            messages: [
              { role: "system", content: INTENT_SPEC_SYSTEM_PROMPT },
              {
                role: "user",
                content: buildIntentSpecUserMessage({
                  input: pipeline.sanitized,
                  type: pipeline.type,
                  complexity,
                  missing: pipeline.missing,
                  entities: pipeline.entities,
                  qualifiers: pipeline.qualifiers,
                  coreTopic: pipeline.coreTopic,
                  subDomain: pipeline.subDomain,
                  safety,
                  critique: specCritique,
                }),
              },
            ],
            maxTokens: 1400,
            temperature: 0.1,
            requestId,
          });
          provider = call.provider;
          inferenceMs += call.elapsedMs;
          if (call.fallbackUsed) {
            fallbackUsed = true;
            fallbackReason = "provider_failover";
          }
          providerFailureDetails = [...providerFailureDetails, ...call.failureMessages];
          specResponse = call.output;
        } catch (error) {
          throw mapProviderError(error);
        }

        const parsedSpec = parseIntentSpec(specResponse);
        if (parsedSpec) {
          intentSpec = parsedSpec;
          break;
        }

        specCritique =
          "Previous response did not match the JSON schema. Return valid JSON only with concrete values.";
      }

      if (!intentSpec) {
        intentSpec = buildHeuristicIntentSpec({
          input: pipeline.sanitized,
          type: pipeline.type,
          complexity,
          safety,
        });
        fallbackUsed = true;
        fallbackReason = "heuristic_intent_spec";
        composeIssues = [...new Set([...composeIssues, "heuristic_intent_spec_used"])];
      }

      let composeCritique: string | undefined;
      for (let index = 0; index <= MAX_INFERENCE_RETRIES; index += 1) {
        attempts += 1;
        let composeResponse: string;
        try {
          const call = await callProviderWithFailover({
            mode: effectiveMode,
            messages: [
              { role: "system", content: COMPOSE_SYSTEM_PROMPT },
              {
                role: "user",
                content: buildComposeUserMessage({
                  input: pipeline.sanitized,
                  spec: intentSpec,
                  type: pipeline.type,
                  complexity,
                  safety,
                  critique: composeCritique,
                }),
              },
            ],
            maxTokens: 2800,
            temperature: 0.2,
            requestId,
          });
          provider = call.provider;
          inferenceMs += call.elapsedMs;
          if (call.fallbackUsed) {
            fallbackUsed = true;
            fallbackReason = "provider_failover";
          }
          providerFailureDetails = [...providerFailureDetails, ...call.failureMessages];
          composeResponse = call.output;
        } catch (error) {
          throw mapProviderError(error);
        }

        const parsedCompose = parseComposeOutput(composeResponse);
        if (!parsedCompose) {
          composeCritique =
            "Previous response was not valid JSON for balanced/advanced/max_pro/explanation fields.";
          continue;
        }

        const deterministicCompose = buildTemplateFallbackComposeOutput({
          input: pipeline.sanitized,
          type: pipeline.type,
          intentSpec,
          safety,
        });

        const modelBalancedEval = evaluateEngineeredPrompt({
          prompt: parsedCompose.balanced,
          input: pipeline.sanitized,
          variant: "balanced",
          intentSpec,
          type: pipeline.type,
          complexity,
        });
        const modelAdvancedEval = evaluateEngineeredPrompt({
          prompt: parsedCompose.advanced,
          input: pipeline.sanitized,
          variant: "advanced",
          intentSpec,
          type: pipeline.type,
          complexity: "complex",
        });
        const modelMaxProEval = evaluateEngineeredPrompt({
          prompt: parsedCompose.max_pro,
          input: pipeline.sanitized,
          variant: "max_pro",
          intentSpec,
          type: pipeline.type,
          complexity: "complex",
        });

        const deterministicBalancedEval = evaluateEngineeredPrompt({
          prompt: deterministicCompose.balanced,
          input: pipeline.sanitized,
          variant: "balanced",
          intentSpec,
          type: pipeline.type,
          complexity,
        });
        const deterministicAdvancedEval = evaluateEngineeredPrompt({
          prompt: deterministicCompose.advanced,
          input: pipeline.sanitized,
          variant: "advanced",
          intentSpec,
          type: pipeline.type,
          complexity: "complex",
        });
        const deterministicMaxProEval = evaluateEngineeredPrompt({
          prompt: deterministicCompose.max_pro,
          input: pipeline.sanitized,
          variant: "max_pro",
          intentSpec,
          type: pipeline.type,
          complexity: "complex",
        });

        const balancedChoice = pickPreferredVariant({
          modelPrompt: parsedCompose.balanced,
          modelEval: modelBalancedEval,
          deterministicPrompt: deterministicCompose.balanced,
          deterministicEval: deterministicBalancedEval,
        });
        const advancedChoice = pickPreferredVariant({
          modelPrompt: parsedCompose.advanced,
          modelEval: modelAdvancedEval,
          deterministicPrompt: deterministicCompose.advanced,
          deterministicEval: deterministicAdvancedEval,
        });
        const maxProChoice = pickPreferredVariant({
          modelPrompt: parsedCompose.max_pro,
          modelEval: modelMaxProEval,
          deterministicPrompt: deterministicCompose.max_pro,
          deterministicEval: deterministicMaxProEval,
        });

        const selectedCompose: ComposeOutput = {
          balanced: balancedChoice.prompt,
          advanced: advancedChoice.prompt,
          max_pro: maxProChoice.prompt,
          explanation:
            balancedChoice.source === "deterministic" ||
            advancedChoice.source === "deterministic" ||
            maxProChoice.source === "deterministic"
              ? `${parsedCompose.explanation} Output was upgraded with deterministic quality scaffolding where it outperformed the model draft.`
              : parsedCompose.explanation,
        };

        qualityScore = Math.min(
          balancedChoice.evaluation.score,
          advancedChoice.evaluation.score,
          maxProChoice.evaluation.score,
        );
        balancedBreakdown = balancedChoice.evaluation.breakdown;
        composeIssues = [
          ...new Set([
            ...balancedChoice.evaluation.issues,
            ...advancedChoice.evaluation.issues,
            ...maxProChoice.evaluation.issues,
            ...(balancedChoice.source === "deterministic" ||
            advancedChoice.source === "deterministic" ||
            maxProChoice.source === "deterministic"
              ? ["deterministic_upgrade_applied"]
              : []),
          ]),
        ];

        if (
          balancedChoice.evaluation.passed &&
          advancedChoice.evaluation.passed &&
          maxProChoice.evaluation.passed
        ) {
          composeOutput = selectedCompose;
          break;
        }

        composeCritique = `Failed quality gate issues: ${composeIssues.join(", ")}.
Rewrite the prompts to be directly usable, high-precision, domain-rich, and appropriately concise.`;
      }

      if (!composeOutput) {
        throw new TransformFailure(
          "QUALITY_GATE_FAILED",
          "Generated prompt variants failed the quality gate after retry.",
          502,
        );
      }
    } catch (error) {
      const failure =
        error instanceof TransformFailure
          ? error
          : new TransformFailure(
              "INFERENCE_UNAVAILABLE",
              "Inference provider is unavailable.",
              502,
            );

      const shouldFallback =
        PROVIDER_FALLBACK_ENABLED &&
        (failure.code === "INFERENCE_UNAVAILABLE" ||
          failure.code === "PROVIDER_CONFIG_MISSING" ||
          failure.code === "INTENT_SPEC_INVALID" ||
          failure.code === "QUALITY_GATE_FAILED");

      if (shouldFallback) {
        composeOutput = buildTemplateFallbackComposeOutput({
          input: pipeline.sanitized,
          type: pipeline.type,
          intentSpec,
          safety,
        });
        provider = mapProviderFromMode(effectiveMode);
        fallbackUsed = true;
        fallbackReason = `deterministic_fallback:${failure.code}`;

        const balancedEval = evaluateEngineeredPrompt({
          prompt: composeOutput.balanced,
          input: pipeline.sanitized,
          variant: "balanced",
          intentSpec: intentSpec ?? undefined,
          type: pipeline.type,
          complexity,
        });

        const advancedEval = evaluateEngineeredPrompt({
          prompt: composeOutput.advanced,
          input: pipeline.sanitized,
          variant: "advanced",
          intentSpec: intentSpec ?? undefined,
          type: pipeline.type,
          complexity: "complex",
        });
        const maxProEval = evaluateEngineeredPrompt({
          prompt: composeOutput.max_pro,
          input: pipeline.sanitized,
          variant: "max_pro",
          intentSpec: intentSpec ?? undefined,
          type: pipeline.type,
          complexity: "complex",
        });

        qualityScore = Math.min(balancedEval.score, advancedEval.score, maxProEval.score);
        balancedBreakdown = balancedEval.breakdown;
        composeIssues = [
          ...new Set([
            ...balancedEval.issues,
            ...advancedEval.issues,
            ...maxProEval.issues,
            `provider_failure:${failure.code}`,
          ]),
        ];
      } else {
        await safeRecordAdminActivity({
          requestedMode,
          effectiveMode,
          style,
          status: "failed",
          latencyMs: Date.now() - requestStartedAt,
          errorCode: failure.code,
          provider,
          attempts,
          inferenceMs,
          qualityGatePassed: false,
          qualityScore,
          qualityIssues: [...composeIssues, ...providerFailureDetails],
          type: pipeline.type,
        });

        return toStructuredError(
          failure.code,
          failure.message,
          failure.status,
          requestId,
          failure.details,
        );
      }
    }
  }

  if (!composeOutput) {
    return toStructuredError(
      "INFERENCE_UNAVAILABLE",
      "Unable to produce prompt output.",
      502,
      requestId,
    );
  }

  const allQualityIssues = [...new Set([...composeIssues, ...providerFailureDetails])];
  const qualityGatePassed = !hasQualityGateIssues(composeIssues);

  const result: TransformResponse = {
    prompt: composeOutput.balanced,
    variants: {
      balanced: composeOutput.balanced,
      advanced: composeOutput.advanced,
      max_pro: composeOutput.max_pro,
    },
    score: qualityScore,
    breakdown: balancedBreakdown,
    explanation: composeOutput.explanation,
    type: pipeline.type,
    meta: {
      provider,
      attempts,
      inferenceMs,
      qualityScore,
      qualityPassed: qualityGatePassed,
      qualityIssues: allQualityIssues,
      fallbackUsed,
      fallbackReason: fallbackUsed ? fallbackReason : undefined,
      requestId,
    },
  };

  await safeRecordAdminActivity({
    requestedMode,
    effectiveMode,
    style,
    status: "success",
    latencyMs: Date.now() - requestStartedAt,
    score: qualityScore,
    type: pipeline.type,
    provider,
    attempts,
    inferenceMs,
    qualityGatePassed,
    qualityScore,
    qualityIssues: allQualityIssues,
    errorCode: fallbackUsed
      ? fallbackReason.startsWith("safety_guard")
        ? "SAFETY_GUARD_USED"
        : "PROVIDER_FALLBACK_USED"
      : undefined,
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(streamLine(event));

      try {
        send({ event: "stage", stage: "sanitize" });
        send({ event: "stage", stage: "classify", data: { type: pipeline.type } });
        send({ event: "stage", stage: "intent_spec", data: { attempts } });
        send({ event: "stage", stage: "compose", data: { provider, fallbackUsed } });
        send({
          event: "stage",
          stage: "quality_gate",
          data: { score: qualityScore },
        });
        send({ event: "stage", stage: "done" });
        send({ event: "result", data: result });
        send({ event: "done" });
        controller.close();
      } catch {
        send({
          event: "error",
          code: "INFERENCE_UNAVAILABLE",
          message: "Streaming failed while sending response.",
        });
        send({ event: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
