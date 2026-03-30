import type {
  MissingDetail,
  PipelineResult,
  PromptStyle,
  PromptType,
  PromptVariants,
  ScoreBreakdown,
} from "@/lib/types";

const STYLE_TO_TYPE: Record<PromptStyle, PromptType> = {
  general: "general",
};

const INJECTION_PATTERNS = [
  /ignore\s+all\s+(previous|prior)\s+instructions/gi,
  /disregard\s+the\s+above/gi,
  /you\s+are\s+now/gi,
  /act\s+as\s+/gi,
  /system\s*:/gi,
  /developer\s*:/gi,
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const SECTION_HEADERS = [
  "Prompt:",
  "Your response must include:",
  "Constraints:",
] as const;

type InferredProfile = {
  audience: string;
  tone: string;
  outputFormat: string;
  lengthTarget: string;
  roleLead: string;
  taskLine: string;
};

type PromptDomain =
  | "agriculture"
  | "health"
  | "finance"
  | "legal"
  | "general";

export function sanitizeInput(input: string): string {
  let sanitized = input.replace(/\0/g, "");
  sanitized = sanitized.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[stripped-instruction]");
  }

  sanitized = sanitized
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return sanitized;
}

export function classifyPromptType(input: string, style?: PromptStyle): PromptType {
  if (style && style !== "general" && STYLE_TO_TYPE[style]) {
    return STYLE_TO_TYPE[style];
  }

  const text = input.toLowerCase();

  if (/(python|typescript|javascript|api|refactor|bug|test|algorithm|database schema|edge case)/i.test(text)) {
    return "coding";
  }

  if (/(literature review|citation|methodology|hypothesis|source analysis|peer-reviewed)/i.test(text)) {
    return "research";
  }

  if (/(revenue|kpi|roadmap|stakeholder|pricing|go-to-market|sales|operations)/i.test(text)) {
    return "business";
  }

  if (/(story|novel|poem|script|dialogue|character arc|worldbuilding)/i.test(text)) {
    return "creative";
  }

  if (/(render|camera|lighting|composition|midjourney|stable diffusion|cinematic shot)/i.test(text)) {
    return "image";
  }

  const hasStudySignals =
    /(study plan|quiz|lesson|exam|memorize|learning objectives|syllabus|chapter|revision|board exam|class\s*\d+|grade\s*\d+|\b11th\b|\b12th\b)/i.test(
      text,
    ) ||
    (/(learn|master|improve|prepare)/i.test(text) &&
      /(math|mathematics|physics|chemistry|biology|history|geography|english|economics|subject)/i.test(text));

  if (hasStudySignals) {
    return "study";
  }

  return "general";
}

export function detectMissingDetails(input: string): MissingDetail[] {
  const text = input.toLowerCase();
  const missing: MissingDetail[] = [];

  if (!/(for\s+|audience|target\s+user|beginner|expert|team|student|customer)/i.test(text)) {
    missing.push("audience");
  }

  if (!/(tone|formal|casual|professional|friendly|concise|persuasive|technical)/i.test(text)) {
    missing.push("tone");
  }

  if (!/(format|table|json|bullet|markdown|list|outline|steps|sections)/i.test(text)) {
    missing.push("format");
  }

  if (!/(length|words|paragraph|short|detailed|brief|under\s+\d+)/i.test(text)) {
    missing.push("length");
  }

  if (!/(must|avoid|constraint|limit|do\s+not|strict|requirements)/i.test(text)) {
    missing.push("constraints");
  }

  if (!/(output|deliverable|return|response|result)/i.test(text)) {
    missing.push("output_type");
  }

  return missing;
}

const typeHints: Record<PromptType, string> = {
  coding:
    "Define language/runtime assumptions, architecture boundaries, validation logic, testing strategy, and edge-case handling.",
  research:
    "Require clear research framing, evidence quality checks, source handling, and citation behavior.",
  business:
    "Define objective, stakeholders, measurable outcomes, assumptions, and implementation constraints.",
  creative:
    "Define narrative intent, style influences, emotional tone, constraints, and quality criteria.",
  image:
    "Include subject, style, lighting, composition, color palette, and negative prompt constraints.",
  study:
    "Include learner level, topic scope, pacing, milestones, and practice/assessment format.",
  general:
    "Demand clear objective, constraints, format expectations, and quality checks.",
};

function buildGapGuidance(missing: MissingDetail[]): string[] {
  if (missing.length === 0) {
    return [];
  }

  return [
    "If critical details are missing, state assumptions briefly and provide the safest practical path.",
  ];
}

function firstSentence(text: string): string {
  const sentence = text.split(/[.!?\n]/).find((piece) => piece.trim().length > 8);
  return sentence?.trim() ?? text.slice(0, 160).trim();
}

function inferAudience(input: string, type: PromptType): string {
  const explicit = input.match(/(?:audience|for)[:\s-]+([^\n,.]{4,80})/i)?.[1]?.trim();
  if (explicit) {
    return explicit;
  }

  switch (type) {
    case "coding":
      return "engineers building production-grade software";
    case "research":
      return "researchers and analysts who require evidence-backed output";
    case "business":
      return "decision-makers and operators responsible for measurable outcomes";
    case "creative":
      return "creative professionals seeking distinctive, publishable-quality work";
    case "image":
      return "visual creators designing high-fidelity generation prompts";
    case "study":
      return "learners aiming for mastery, retention, and practical application";
    default:
      return "professionals who need clear, high-signal output without ambiguity";
  }
}

function inferTone(input: string, type: PromptType): string {
  const match = input.match(/(?:tone|style)[:\s-]+([^\n,.]{3,60})/i)?.[1]?.trim();
  if (match) {
    return match;
  }

  switch (type) {
    case "business":
      return "executive-ready, concise, and strategically rigorous";
    case "research":
      return "analytical, evidence-driven, and academically precise";
    case "coding":
      return "technical, direct, and implementation-first";
    case "creative":
      return "evocative yet controlled, imaginative but purposeful";
    case "image":
      return "cinematic, vivid, and composition-aware";
    case "study":
      return "clear, coaching-oriented, and memory-optimized";
    default:
      return "professional, high-clarity, and outcomes-focused";
  }
}

function inferOutputFormat(type: PromptType): string {
  switch (type) {
    case "coding":
      return "Use markdown headings and numbered steps, with code blocks only where needed.";
    case "research":
      return "Use markdown headings with evidence-backed claims, assumptions, and limitations.";
    case "business":
      return "Use concise markdown with action tables (owner, KPI, timeline, risk).";
    case "creative":
      return "Use markdown sections with clear constraints and an explicit final deliverable.";
    case "image":
      return "Use a deterministic image-prompt template with labeled fields.";
    case "study":
      return "Use markdown headings with numbered actions and checkpoints.";
    default:
      return "Use clean markdown with explicit headings and numbered steps.";
  }
}

function inferDomain(input: string): PromptDomain {
  const text = input.toLowerCase();

  if (
    /(planofix|pgr|spray|spraying|dose per liter|crop|fertilizer|fertiliser|pesticide|herbicide|fungicide|agronomy|acre|hectare|foliar|plant growth regulator|tank mix)/i.test(
      text,
    )
  ) {
    return "agriculture";
  }

  if (/(symptom|dose|dosage|medication|treatment|side effect|diagnosis|clinical|patient)/i.test(text)) {
    return "health";
  }

  if (/(tax|portfolio|investment|loan|interest rate|cash flow|valuation|budget)/i.test(text)) {
    return "finance";
  }

  if (/(contract|clause|liability|legal|law|compliance|jurisdiction|statute)/i.test(text)) {
    return "legal";
  }

  return "general";
}

function inferLengthTarget(input: string): string {
  const text = input.toLowerCase();
  if (/(brief|short|quick|concise)/i.test(text)) {
    return "Concise but complete (roughly 180-260 words).";
  }

  if (/(exhaustive|deep|detailed|comprehensive)/i.test(text)) {
    return "Comprehensive and deeply specified (roughly 450-700 words).";
  }

  if (input.length > 1400) {
    return "Detailed and layered (roughly 380-560 words).";
  }

  return "Balanced depth (roughly 260-420 words).";
}

function inferRoleLead(input: string, type: PromptType, domain: PromptDomain): string {
  if (type === "study" && /(math|mathematics|algebra|geometry|trigonometry|calculus)/i.test(input)) {
    return "Act as an expert mathematics educator and cognitive learning scientist.";
  }

  if (domain === "agriculture") {
    return "Act as an agricultural extension agronomist with practical field-safety expertise in plant growth regulators and spray scheduling.";
  }

  if (domain === "health") {
    return "Act as a clinical decision-support assistant focused on safety, uncertainty disclosure, and evidence-based guidance.";
  }

  if (domain === "finance") {
    return "Act as a financial planning analyst focused on risk-aware, assumptions-explicit recommendations.";
  }

  if (domain === "legal") {
    return "Act as a legal information assistant that provides structured, jurisdiction-aware guidance without giving definitive legal advice.";
  }

  switch (type) {
    case "coding":
      return "Act as a senior software engineer and systems architect.";
    case "research":
      return "Act as a senior researcher and evidence synthesis specialist.";
    case "business":
      return "Act as a strategy consultant focused on measurable execution.";
    case "creative":
      return "Act as a creative director and narrative craft specialist.";
    case "image":
      return "Act as a world-class visual prompt engineer for image generation.";
    case "study":
      return "Act as an expert educator and cognitive learning strategist.";
    default:
      return "Act as a domain expert advisor focused on clear, actionable outcomes.";
  }
}

function normalizeIntentText(text: string): string {
  return text
    .replace(/\bleran\b/gi, "learn")
    .replace(/\bquicky\b/gi, "quickly")
    .replace(/\bteh\b/gi, "the")
    .replace(/\s+/g, " ")
    .trim();
}

function inferTaskLine(input: string, type: PromptType, domain: PromptDomain): string {
  const intent = normalizeIntentText(firstSentence(input)).replace(/[.!?]+$/g, "");

  if (domain === "agriculture") {
    return `Provide a safety-first, practical crop-management answer to: ${intent}.`;
  }

  if (domain === "health") {
    return `Provide a cautious, evidence-based response to: ${intent}.`;
  }

  if (/^how to\s+/i.test(intent)) {
    const goal = intent.replace(/^how to\s+/i, "").trim();
    if (type === "study") {
      return `Provide a scientifically grounded, step-by-step strategy to ${goal} in the shortest realistic time frame.`;
    }

    return `Provide a practical, step-by-step strategy to ${goal} with clear reasoning and implementation detail.`;
  }

  return `Address this request with precise, actionable guidance: \"${intent}\".`;
}

function inferProfile(input: string, type: PromptType): InferredProfile {
  const domain = inferDomain(input);

  return {
    audience: inferAudience(input, type),
    tone: inferTone(input, type),
    outputFormat: inferOutputFormat(type),
    lengthTarget: inferLengthTarget(input),
    roleLead: inferRoleLead(input, type, domain),
    taskLine: inferTaskLine(input, type, domain),
  };
}

function buildResponseSections(type: PromptType, input: string): string[] {
  const domain = inferDomain(input);

  const class11Math =
    type === "study" &&
    /(class\s*11|11th|grade\s*11|\bxi\b)/i.test(input) &&
    /(math|mathematics|algebra|geometry|trigonometry|calculus)/i.test(input);

  if (class11Math) {
    return [
      "Learning Framework: explain conceptual clarity -> problem-solving -> mastery, using active recall, spaced repetition, and deliberate practice.",
      "Syllabus Breakdown (Class 11): organize Algebra, Trigonometry, Calculus basics, Coordinate Geometry, and Statistics; identify foundational and high-weight topics.",
      "Daily and Weekly Study Plan: provide a realistic schedule with hours per day, revision cycles, and theory/practice/revision split.",
      "Problem-Solving Strategy: define a step-by-step method for difficult questions, including error analysis and pattern recognition.",
      "Memory and Retention Techniques: include practical methods for formula retention and long-term concept recall.",
      "Common Mistakes to Avoid: list critical mistakes and exact correction steps.",
      "Acceleration Techniques: show how to compress learning time without sacrificing understanding.",
      "Verification and Self-Testing: include measurable checkpoints, mock-test cadence, and adjustment rules.",
    ];
  }

  if (domain === "agriculture") {
    return [
      "Direct recommendation first: provide the safest practical answer, then explain why.",
      "Required context check: crop, growth stage, exact product formulation, concentration label, spray water volume, weather window, and tank-mix sequence.",
      "Dosage and timing logic: explain how to decide whether post-spray application is appropriate and how interval timing changes risk.",
      "Safety and compliance: prioritize product label instructions, local agricultural extension guidance, and phytotoxicity prevention.",
      "Action plan: give a concise field-ready checklist for what to do now and what to verify before next spray.",
    ];
  }

  switch (type) {
    case "coding":
      return [
        "Technical context and assumptions.",
        "Step-by-step implementation plan.",
        "Validation and testing strategy.",
        "Edge cases, failure modes, and mitigations.",
      ];
    case "research":
      return [
        "Research framing and key assumptions.",
        "Evidence-based reasoning with source quality cues.",
        "Findings and decision implications.",
        "Limitations, risks, and confidence level.",
      ];
    case "business":
      return [
        "Objective and success metrics.",
        "Execution plan with owners and timeline.",
        "Risk register with mitigation triggers.",
        "Review checkpoints and decision criteria.",
      ];
    case "creative":
      return [
        "Creative direction and style boundaries.",
        "Structure and progression of the output.",
        "Originality guardrails and quality checks.",
        "Final polish and consistency checklist.",
      ];
    case "image":
      return [
        "Subject and focal hierarchy.",
        "Style, color palette, and visual mood.",
        "Lighting, composition, and camera details.",
        "Negative prompt constraints and artifact prevention.",
      ];
    case "study":
      return [
        "Learning roadmap with milestones.",
        "Practice strategy and revision cycles.",
        "Retention methods and memory reinforcement.",
        "Self-testing rubric and adaptation rules.",
      ];
    default:
      return [
        "Direct answer first in 2-4 lines.",
        "Concise reasoning with assumptions and decision criteria.",
        "Step-by-step practical actions.",
        "Risks, caveats, and a final verification checklist.",
      ];
  }
}

function summarizeContext(input: string): string {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  return lines.length > 220 ? `${lines.slice(0, 217)}...` : lines;
}

export function expandPrompt(options: {
  sanitized: string;
  type: PromptType;
  style: PromptStyle;
  missing: MissingDetail[];
}): string {
  const { sanitized, type, style, missing } = options;
  const domain = inferDomain(sanitized);
  const gapGuidance = buildGapGuidance(missing);
  const profile = inferProfile(sanitized, type);
  const sections = buildResponseSections(type, sanitized);

  const domainConstraintByType =
    domain === "agriculture"
      ? "Do not invent exact chemical dose values when product-label concentration, crop stage, or local label constraints are unknown; ask for missing details and give the safest fallback path."
      : domain === "health"
        ? "Do not provide unsafe or absolute medical instructions without uncertainty qualifiers and escalation guidance."
        : domain === "finance"
          ? "Clearly separate assumptions from facts and include risk disclosure for recommendations."
          : domain === "legal"
            ? "Provide informational guidance only and include a note to verify with a qualified professional in the relevant jurisdiction."
            : "When key details are missing, ask targeted clarifying questions and provide a safe default approach.";

  return [
    "Prompt:",
    profile.roleLead,
    profile.taskLine,
    "",
    "Your response must include:",
    ...sections.map((section) => `- ${section}`),
    "",
    "Constraints:",
    `- ${typeHints[type]}`,
    `- Write for: ${profile.audience}`,
    `- Tone: ${profile.tone}`,
    `- Output format: ${profile.outputFormat}`,
    `- Response length: ${profile.lengthTarget}`,
    "- Use clear headings and numbered steps where applicable.",
    `- ${domainConstraintByType}`,
    ...gapGuidance.map((line) => `- ${line}`),
    "- Do not give vague advice.",
    "- Provide actionable, step-by-step guidance and explain why each method works.",
    "- Avoid unsupported claims; rely on established principles or clearly stated assumptions.",
    "- Keep language high-signal, concrete, and testable.",
    "",
    "Return only the final answer.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function createVariants(expandedPrompt: string): PromptVariants {
  const compact = expandedPrompt
    .replace(/\n- Length target:[^\n]*/m, "")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .slice(0, 18)
    .join("\n")
    .trim();

  const advanced = [
    expandedPrompt,
    "",
    "Additional quality bar:",
    "- Include explicit failure-case prevention notes.",
    "- Add acceptance criteria for an excellent final answer.",
    "- End with a concise self-check before finalizing.",
  ].join("\n");

  return {
    short: compact,
    balanced: expandedPrompt,
    advanced,
  };
}

export function scorePrompt(prompt: string, missing: MissingDetail[]): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  const headingCount = (prompt.match(/^[A-Za-z][A-Za-z\-/ ]+:$/gm) ?? []).length;
  const hasConstraints = /constraints/i.test(prompt);
  const sectionCoverage = SECTION_HEADERS.reduce(
    (count, section) => count + (prompt.includes(section) ? 1 : 0),
    0,
  );
  const explicitBullets = (prompt.match(/^-\s+/gm) ?? []).length;

  const clarity = clamp(9 + sectionCoverage * 3 + Math.min(6, explicitBullets), 0, 25);
  const specificity = clamp(10 + Math.floor(wordCount / 38) + (missing.length <= 2 ? 2 : 0), 0, 25);
  const constraints = clamp(10 + (hasConstraints ? 7 : 0) + (6 - missing.length), 0, 25);
  const structure = clamp(8 + headingCount * 2 + sectionCoverage, 0, 25);

  const score = clamp(
    Math.round((clarity + specificity + constraints + structure) / 4),
    0,
    100,
  );

  return {
    score,
    breakdown: {
      clarity,
      specificity,
      constraints,
      structure,
    },
  };
}

export function explainChanges(type: PromptType, missing: MissingDetail[]): string {
  const resolved =
    missing.length > 0
      ? `It inferred and filled missing details for ${missing.join(", ")} so the output has concrete boundaries instead of ambiguity.`
      : "It preserved your provided detail while sharpening each instruction into explicit, execution-ready constraints.";

  return `The rewrite upgrades your input into an elite ${type} prompt with a direct, runnable structure: Prompt, required response sections, output requirements, and constraints. ${resolved}`;
}

export function runPipeline(input: string, style: PromptStyle = "general"): PipelineResult {
  const sanitized = sanitizeInput(input);
  const type = classifyPromptType(sanitized, style);
  const missing = detectMissingDetails(sanitized);
  const prompt = expandPrompt({ sanitized, type, style, missing });
  const variants = createVariants(prompt);
  const { score, breakdown } = scorePrompt(prompt, missing);
  const explanation = explainChanges(type, missing);

  return {
    sanitized,
    type,
    missing,
    prompt,
    variants,
    score,
    breakdown,
    explanation,
  };
}
