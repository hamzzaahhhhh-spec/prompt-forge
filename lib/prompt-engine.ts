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

export function expandPrompt(options: {
  sanitized: string;
  type: PromptType;
  style: PromptStyle;
  missing: MissingDetail[];
}): string {
  const { sanitized, type, style, missing } = options;
  const gapGuidance = buildGapGuidance(missing);

  const imageExtra =
    type === "image"
      ? [
          "Image Prompt Fields:",
          "- Subject",
          "- Style",
          "- Lighting",
          "- Composition",
          "- Negative Prompt",
        ].join("\n")
      : "";

  const codeExtra =
    type === "coding"
      ? [
          "Code Prompt Fields:",
          "- Language and runtime",
          "- Architecture and design constraints",
          "- Test strategy",
          "- Edge cases and failure modes",
        ].join("\n")
      : "";

  return [
    "Role:",
    "You are an expert prompt engineer.",
    "",
    "Objective:",
    "Rewrite the source material into a high-quality prompt that is explicit, structured, and execution-ready.",
    "",
    "Prompt Type:",
    `- ${type.toUpperCase()}`,
    `- Preferred style: ${style.toUpperCase()}`,
    "",
    "Source Material:",
    sanitized,
    "",
    "Quality Requirements:",
    `- ${typeHints[type]}`,
    "- Preserve intent, remove ambiguity, and avoid answering source questions directly.",
    "- Include context, constraints, and an explicit output format.",
    "",
    "Gap Resolution:",
    ...gapGuidance.map((line) => `- ${line}`),
    "",
    "Output Format:",
    "Return a single improved prompt with clear sections:",
    "1) Context",
    "2) Task",
    "3) Constraints",
    "4) Output Format",
    "5) Quality Bar",
    imageExtra,
    codeExtra,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createVariants(expandedPrompt: string): PromptVariants {
  const compact = expandedPrompt
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .slice(0, 18)
    .join("\n")
    .trim();

  const advanced = [
    expandedPrompt,
    "",
    "Advanced Enhancements:",
    "- Include assumptions explicitly when source context is incomplete.",
    "- Add a short self-checklist before final output.",
    "- Require deterministic formatting and no extra commentary.",
    "- If uncertainty exists, ask for narrowly scoped clarification as final line.",
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
  const headingCount = (prompt.match(/^[A-Za-z][A-Za-z ]+:$/gm) ?? []).length;
  const hasConstraints = /constraints/i.test(prompt);
  const hasFormat = /output\s+format/i.test(prompt);

  const clarity = clamp(12 + headingCount * 3 + (hasFormat ? 3 : 0), 0, 25);
  const specificity = clamp(10 + Math.floor(wordCount / 45), 0, 25);
  const constraints = clamp(10 + (hasConstraints ? 8 : 0) + (6 - missing.length), 0, 25);
  const structure = clamp(11 + headingCount * 3 + (hasFormat ? 4 : 0), 0, 25);

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
      ? `It filled missing details for ${missing.join(", ")} so the model has clearer boundaries.`
      : "It preserved your existing details and tightened them into explicit constraints.";

  return `The rewrite converts raw material into a structured ${type} prompt with explicit context, task framing, and output rules. ${resolved}`;
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
