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
  code: "coding",
  research: "research",
  business: "business",
  creative: "creative",
  image: "image",
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
  "Role:",
  "Objective:",
  "Context:",
  "Step-by-step instructions:",
  "Constraints:",
  "Output format:",
  "Tone/style:",
] as const;

type InferredProfile = {
  audience: string;
  tone: string;
  outputFormat: string;
  lengthTarget: string;
  objectiveFocus: string;
};

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
  if (style && STYLE_TO_TYPE[style]) {
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

  if (/(study plan|quiz|lesson|exam|memorize|learning objectives)/i.test(text)) {
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
    "Specify language/runtime, architecture decisions, validation, testing strategy, and edge-case handling.",
  research:
    "Require clear research question framing, evidence quality checks, source handling, and citation behavior.",
  business:
    "Define business objective, stakeholders, measurable outcomes, assumptions, and implementation constraints.",
  creative:
    "Define narrative intent, style influences, emotional tone, constraints, and quality criteria.",
  image:
    "Include subject, style, lighting, camera/composition, color palette, and negative prompt constraints.",
  study:
    "Include learner level, topic scope, pacing, milestones, and practice/assessment format.",
  general:
    "Demand clear objective, constraints, format expectations, and output quality checks.",
};

function buildGapGuidance(missing: MissingDetail[]): string[] {
  return missing.map((detail) => {
    switch (detail) {
      case "audience":
        return "Audience: infer and state the likely target audience explicitly.";
      case "tone":
        return "Tone: select an appropriate tone and state it explicitly.";
      case "format":
        return "Format: define an explicit output structure (headings, bullets, or JSON).";
      case "length":
        return "Length: include a practical length target (brief/medium/detailed).";
      case "constraints":
        return "Constraints: add concrete do/do-not rules and quality boundaries.";
      case "output_type":
        return "Output Type: define exactly what artifact should be returned.";
      default:
        return "Missing detail: resolve ambiguity explicitly.";
    }
  });
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
      return "Markdown sections with architecture, implementation plan, test matrix, and edge cases.";
    case "research":
      return "Structured report with thesis, method, findings, citations approach, and limitations.";
    case "business":
      return "Action plan with objectives, KPIs, assumptions, timeline, risks, and owner-by-owner actions.";
    case "creative":
      return "Creative brief with thematic intent, stylistic guidance, constraints, and final deliverable spec.";
    case "image":
      return "Image-prompt block including Subject, Style, Lighting, Composition, Camera details, and Negative Prompt.";
    case "study":
      return "Learning blueprint with modules, progression, active recall tasks, and assessment checkpoints.";
    default:
      return "Clean markdown with numbered steps, strict constraints, and explicit final output section.";
  }
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

function inferObjectiveFocus(input: string, type: PromptType): string {
  const seed = firstSentence(input);
  return `Translate the core intent \"${seed}\" into an elite ${type} prompt that is specific, executable, and quality-controlled.`;
}

function inferProfile(input: string, type: PromptType): InferredProfile {
  return {
    audience: inferAudience(input, type),
    tone: inferTone(input, type),
    outputFormat: inferOutputFormat(type),
    lengthTarget: inferLengthTarget(input),
    objectiveFocus: inferObjectiveFocus(input, type),
  };
}

function buildInstructionSteps(type: PromptType): string[] {
  const common = [
    "Extract and preserve the true intent from the source material.",
    "Resolve ambiguity by introducing explicit assumptions only where needed.",
    "Sequence the task into execution-ready actions with no vague verbs.",
    "Specify quality checks so output can be audited for completeness.",
  ];

  switch (type) {
    case "coding":
      return [
        ...common,
        "Define stack, architecture constraints, and implementation boundaries.",
        "Include test strategy, edge cases, and failure-mode handling.",
      ];
    case "research":
      return [
        ...common,
        "Require evidence quality ranking and citation-aware reasoning.",
        "Add limitations, assumptions, and confidence qualifiers.",
      ];
    case "business":
      return [
        ...common,
        "Map actions to measurable KPIs, owners, and time horizons.",
        "Include risk register with mitigation triggers.",
      ];
    case "creative":
      return [
        ...common,
        "Define creative direction, style constraints, and originality guardrails.",
        "Require a final polish pass for rhythm, coherence, and emotional impact.",
      ];
    case "image":
      return [
        ...common,
        "Specify subject hierarchy, composition geometry, and lighting behavior.",
        "Include a deliberate negative prompt to avoid unwanted artifacts.",
      ];
    case "study":
      return [
        ...common,
        "Build progression milestones with active recall and spaced repetition.",
        "Add checkpoints and adaptation rules for weak areas.",
      ];
    default:
      return [
        ...common,
        "Elevate the result with practical examples and decision criteria.",
        "End with a final verification checklist before output.",
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
  const gapGuidance = buildGapGuidance(missing);
  const profile = inferProfile(sanitized, type);
  const steps = buildInstructionSteps(type);

  const imageExtra =
    type === "image"
      ? [
          "- Image-specific requirements:",
          "  - Subject and focal hierarchy",
          "  - Style references and visual era",
          "  - Lighting model and atmosphere",
          "  - Camera framing and composition",
          "  - Negative prompt for exclusion",
        ].join("\n")
      : "";

  const codeExtra =
    type === "coding"
      ? [
          "- Code-specific requirements:",
          "  - Language/runtime and version assumptions",
          "  - Architecture decisions and tradeoff rationale",
          "  - Testing strategy (unit/integration/e2e)",
          "  - Edge cases and failure recovery behavior",
        ].join("\n")
      : "";

  return [
    "Role:",
    `You are a world-class ${type} prompt architect and quality optimizer focused on high-stakes outputs.`,
    "",
    "Objective:",
    profile.objectiveFocus,
    "",
    "Context:",
    `- Prompt type: ${type.toUpperCase()}`,
    `- Preferred style: ${style.toUpperCase()}`,
    `- Intended audience: ${profile.audience}`,
    `- Source summary: ${summarizeContext(sanitized)}`,
    "",
    "Step-by-step instructions:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Constraints:",
    `- ${typeHints[type]}`,
    "- Never answer the source content directly; only produce an improved prompt artifact.",
    "- Remove generic filler and weak phrasing; every instruction must be concrete and testable.",
    "- Preserve user intent while upgrading precision, depth, and execution quality.",
    `- Target length: ${profile.lengthTarget}`,
    ...gapGuidance.map((line) => `- ${line}`),
    imageExtra,
    codeExtra,
    "",
    "Output format:",
    `- ${profile.outputFormat}`,
    "- Include explicit sections and deterministic formatting.",
    "- Return only the upgraded prompt, without commentary.",
    "",
    "Tone/style:",
    `- ${profile.tone}`,
    "- High-signal, low-noise language with decisive action verbs.",
    "",
    "Source material to transform:",
    sanitized,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createVariants(expandedPrompt: string): PromptVariants {
  const compact = expandedPrompt
    .replace(/Source material to transform:[\s\S]*$/m, "")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .slice(0, 22)
    .join("\n")
    .trim();

  const advanced = [
    expandedPrompt,
    "",
    "Advanced optimization directives:",
    "- Add failure-mode prevention rules for likely misunderstanding points.",
    "- Include acceptance criteria that define what excellent output looks like.",
    "- Add an internal quality checklist before finalizing the response.",
    "- When ambiguity remains, state the assumption explicitly and proceed decisively.",
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
  const hasFormat = /output\s+format/i.test(prompt);
  const sectionCoverage = SECTION_HEADERS.reduce(
    (count, section) => count + (prompt.includes(section) ? 1 : 0),
    0,
  );
  const explicitSteps = (prompt.match(/^\d+\.\s+/gm) ?? []).length;

  const clarity = clamp(9 + sectionCoverage * 2 + Math.min(6, explicitSteps), 0, 25);
  const specificity = clamp(10 + Math.floor(wordCount / 38) + (missing.length <= 2 ? 2 : 0), 0, 25);
  const constraints = clamp(10 + (hasConstraints ? 7 : 0) + (6 - missing.length), 0, 25);
  const structure = clamp(8 + headingCount * 2 + sectionCoverage + (hasFormat ? 2 : 0), 0, 25);

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
      ? `It inferred and filled missing details for ${missing.join(", ")} so the model receives concrete boundaries instead of ambiguity.`
      : "It preserved your provided detail while sharpening each instruction into explicit, execution-ready constraints.";

  return `The rewrite upgrades your input into an elite ${type} prompt with a strict structure: role, objective, context, sequential instructions, constraints, output format, and tone. ${resolved}`;
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
