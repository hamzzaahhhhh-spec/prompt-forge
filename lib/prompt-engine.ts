import type {
  MissingDetail,
  PipelineResult,
  PromptStyle,
  PromptType,
  ScoreBreakdown,
  VariantKey,
} from "@/lib/types";

const STYLE_TO_TYPE: Record<PromptStyle, PromptType> & Partial<Record<string, PromptType>> = {
  general: "general",
  coding: "coding",
  research: "research",
  business: "business",
  creative: "creative",
  image: "image",
  study: "study",
  recommendation: "recommendation",
  comparison: "comparison",
  explanation: "explanation",
  tutorial: "tutorial",
  troubleshooting: "troubleshooting",
};

const INJECTION_PATTERNS = [
  /ignore\s+all\s+(previous|prior)\s+instructions/gi,
  /disregard\s+the\s+above/gi,
  /you\s+are\s+now/gi,
  /act\s+as\s+/gi,
  /system\s*:/gi,
  /developer\s*:/gi,
];

const GENERIC_PHRASE_PATTERNS = [
  /you are a domain expert advisor/i,
  /you are an? (elite|world[-\s]?class|top[-\s]?tier)/i,
  /seasoned senior consultant/i,
  /deep domain knowledge/i,
  /ruthless practicality/i,
  /professional who values direct and practical results/i,
  /operating at principal\+? level/i,
  /problem framing/i,
  /step-by-step action plan/i,
  /address this request with precise/i,
  /return only the final answer/i,
  /as an? (ai|language model|assistant)/i,
  /your role is to (help|assist|support)/i,
  /provide (comprehensive|detailed|thorough) (information|guidance|assistance)/i,
  /based on (your|the) (expertise|knowledge|experience)/i,
  /ensure (clarity|quality|accuracy) (and|in|of)/i,
  /feel free to (ask|provide|include)/i,
  /here (is|are) (some|a few|several)/i,
  /high-quality response/i,
  /comprehensive overview/i,
  /let'?s dive in/i,
  /best possible answer/i,
  /provide valuable insights/i,
  /in today's world/i,
];

const PLACEHOLDER_PATTERNS = [
  /\[insert\s/i,
  /\[your\s/i,
  /\[add\s/i,
  /\[specify\s/i,
  /\[describe\s/i,
  /\[provide\s/i,
  /\[enter\s/i,
  /\[fill\s/i,
  /\[topic\]/i,
  /\[field\]/i,
  /\[format\]/i,
  /\{placeholder\}/i,
  /<add\s+details>/i,
  /<insert\s/i,
  /\.\.\.\s*\[/i,
];

const META_OUTPUT_PATTERNS = [
  /\breturn valid json\b/i,
  /\bcritical rules\b/i,
  /\byour only job\b/i,
  /\bstrict json\b/i,
  /\bno markdown\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper prompt\b/i,
  /\belite prompt engineering specialist\b/i,
  /\bjson schema\b/i,
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export type IntentSpec = {
  goal: string;
  audience: string;
  context: string;
  constraints: string[];
  tone: string;
  output_format: string;
  must_include: string[];
  must_avoid: string[];
  assumptions: string[];
};

export type PromptComplexity = "simple" | "complex";

export type SafetyCategory =
  | "violent_wrongdoing"
  | "cyber_abuse"
  | "self_harm"
  | "illicit_drugs"
  | "hate_or_abuse"
  | "sexual_abuse";

export type SafetyAssessment = {
  blocked: boolean;
  category?: SafetyCategory;
  reason?: string;
  safeGoal: string;
};

export type DeterministicComposeOutput = {
  balanced: string;
  advanced: string;
  max_pro: string;
  explanation: string;
};

const DOMAIN_VOCABULARY_SIGNALS: Record<string, RegExp> = {
  coding: /(\berror handling\b|\bedge case|\btype safety\b|\btestab|\bapi contract|\bcomplexity|\brefactor|\bruntime|\bdeploy|\bscalabili)/i,
  research: /(\bmethodolog|\bhypothes|\bepistemi|\bliterature review|\bpeer.?review|\bcitation|\bsource hierarch|\blimitation)/i,
  business: /(\bkpi\b|\broi\b|\bstakeholder|\bmarket|\bstrateg|\brevenue|\bchurn|\bpricin|\bgo.to.market)/i,
  creative: /(\bnarrative\b|\bcharacter\b|\bvoice\b|\bpacing\b|\bsubtext\b|\bstructural tension|\bpov\b|\btense\b)/i,
  study: /(\blearning objective|\bspaced repetition|\bretrieval practice|\bmastery|\bsyllabus|\bweak.topic|\bexam)/i,
  image: /(\bcomposition\b|\blighting\b|\bcamera angle|\bcolor palette|\bcinematic|\brendering|\bart style)/i,
  comparison: /(\bevaluation criteria|\bcomparison (axis|axes)|\bweighting|\bdecision (frame|matrix))/i,
  explanation: /(\bfirst.principles|\banalog|\bmisconception|\bknowledge level|\baudienc)/i,
  tutorial: /(\bprerequisite|\bvalidation checkpoint|\bstep granular|\berror recovery|\bend state)/i,
  troubleshooting: /(\bdiagnostic|\broot cause|\bsymptom|\bmitigation|\brollback|\bisolat)/i,
};

const SAFETY_ALLOWLIST_PATTERN =
  /\b(prevent|prevention|defend|defensive|awareness|educational|education|history|news|report|ethics|legal|safety|fiction|novel|screenplay)\b/i;

const SAFETY_RULES: Array<{
  category: SafetyCategory;
  pattern: RegExp;
  reason: string;
  safeGoal: string;
}> = [
  {
    category: "cyber_abuse",
    pattern:
      /\b(hack|phish|malware|ransomware|keylogger|credential stuffing|steal (?:password|credentials)|bypass authentication|exploit)\b/i,
    reason: "Request appears to seek cyber abuse or unauthorized access guidance.",
    safeGoal: "strengthen account security and cybersecurity defenses",
  },
  {
    category: "violent_wrongdoing",
    pattern:
      /\b(make|build|buy|use).{0,30}\b(bomb|explosive|weapon)|\b(kill|murder|assassinate|poison)\b/i,
    reason: "Request appears to seek violent wrongdoing guidance.",
    safeGoal: "learn lawful personal safety, de-escalation, and crisis prevention",
  },
  {
    category: "self_harm",
    pattern: /\b(suicide|kill myself|self[-\s]?harm|hurt myself|end my life)\b/i,
    reason: "Request appears related to self-harm.",
    safeGoal: "get immediate emotional support and professional crisis resources",
  },
  {
    category: "illicit_drugs",
    pattern: /\b(make|cook|synthesize|manufacture).{0,35}\b(meth|cocaine|heroin|fentanyl)\b/i,
    reason: "Request appears to seek illicit drug production guidance.",
    safeGoal: "learn health risks, legal consequences, and recovery-support options",
  },
  {
    category: "hate_or_abuse",
    pattern: /\b(how to harass|target .* minority|racial slur|incite hate)\b/i,
    reason: "Request appears to seek hateful or abusive behavior guidance.",
    safeGoal: "resolve conflict respectfully and communicate without abuse",
  },
  {
    category: "sexual_abuse",
    pattern: /\b(non-consensual|without consent|underage explicit|exploit minor)\b/i,
    reason: "Request appears to seek sexual abuse guidance.",
    safeGoal: "promote consent, safety, and legal relationship boundaries",
  },
];

const DOMAIN_ROLES: Record<PromptType, string> = {
  coding: "former principal engineer at a FAANG company who now does hands-on architecture consulting for high-growth startups",
  research: "senior research methodologist with fifteen years of peer-reviewed publication experience who now advises doctoral candidates on evidence synthesis",
  business: "former McKinsey engagement manager who now runs a boutique strategy consultancy specializing in execution-first growth planning",
  creative: "award-winning creative director who has edited for major publishing houses and now mentors emerging writers on craft and voice",
  image: "veteran art director who has led visual campaigns for global brands and now specializes in AI-assisted visual production",
  study: "former mathematics olympiad coach who now specializes in accelerated learning for adult learners who previously struggled with the subject",
  recommendation: "influential curator known for unusually precise taste who has built recommendation engines and written buyer's guides for discerning audiences",
  comparison: "senior decision scientist who has designed evaluation frameworks for Fortune 500 procurement and product selection",
  explanation: "gifted teacher who has taught complex subjects to non-specialists at top universities and is known for making concepts click on first explanation",
  tutorial: "senior technical instructor who writes production-grade tutorials and is obsessed with ensuring every reader finishes successfully",
  troubleshooting: "veteran systems reliability engineer who has triaged hundreds of production outages and believes in diagnosis before action",
  general: "hands-on operator known for turning ambiguous requests into executable plans",
};

const DOMAIN_FOCUS: Record<PromptType, string[]> = {
  coding: [
    "Ask for root cause analysis before proposing a fix.",
    "Cover edge cases, error handling, and type safety.",
    "Require test or verification steps after implementation.",
    "Keep recommendations aligned with the current stack and API contracts.",
  ],
  research: [
    "Frame the question, method, and expected evidence quality.",
    "Differentiate strong sources from weak sources.",
    "State limitations and uncertainty clearly.",
    "Include a concise synthesis, not just a source list.",
  ],
  business: [
    "Anchor recommendations to KPIs and measurable outcomes.",
    "Surface trade-offs, risks, and ROI implications.",
    "Prioritize actions by impact and execution effort.",
    "Address stakeholder alignment and decision criteria.",
  ],
  creative: [
    "Specify voice, pacing, and emotional tone.",
    "Include structural guidance such as arc, beats, or progression.",
    "Avoid cliches and generic filler language.",
    "Ask for one polished output, not brainstorming noise.",
  ],
  image: [
    "Specify composition, lighting, and camera perspective.",
    "Set art direction with style cues and quality constraints.",
    "Include subject, mood, and scene coherence requirements.",
    "Avoid contradictory visual instructions.",
  ],
  study: [
    "Design for spaced repetition and retrieval practice.",
    "Prioritize weak topics and exam-relevant skills.",
    "Provide a realistic schedule and checkpoint cadence.",
    "Include practice format and mastery criteria.",
  ],
  recommendation: [
    "Use explicit filters such as quality, style, and recency.",
    "Explain why each recommendation fits.",
    "Avoid obvious, overused suggestions unless justified.",
    "Provide alternatives for different preferences.",
  ],
  comparison: [
    "Define comparison axes before ranking options.",
    "Use weighted criteria and rationale.",
    "Call out context where each option wins.",
    "Finish with a defensible recommendation.",
  ],
  explanation: [
    "Start from first principles with plain language.",
    "Address common misconceptions explicitly.",
    "Use one practical example to ground the concept.",
    "Scale depth to the likely audience level.",
  ],
  tutorial: [
    "State prerequisites before steps.",
    "Use clear steps with validation checkpoints.",
    "Include error recovery guidance.",
    "End with a concrete done-state.",
  ],
  troubleshooting: [
    "Start with symptom isolation and reproducibility.",
    "Prioritize high-probability root causes.",
    "Include rollback or mitigation safeguards.",
    "End with verification and monitoring steps.",
  ],
  general: [
    "Identify the core task and desired end result.",
    "Keep output specific, practical, and directly usable.",
    "Avoid generic motivational language.",
    "Prefer concrete recommendations over abstractions.",
  ],
};

const DOMAIN_OUTPUT_FORMAT: Record<PromptType, { simple: string; complex: string }> = {
  coding: {
    simple:
      "Return: quick diagnosis, exact fix steps, code-level example, and a short verification checklist.",
    complex:
      "Return sections: Context, Root Cause Analysis, Implementation Plan, Edge Cases, and Verification Checklist.",
  },
  research: {
    simple:
      "Return: key findings, evidence strength, limitations, and actionable conclusion.",
    complex:
      "Return sections: Research Question, Method, Evidence Synthesis, Limitations, and Final Recommendation.",
  },
  business: {
    simple: "Return: top priorities, KPI impact, risks, and next actions.",
    complex:
      "Return sections: Current State, Strategic Options, KPI Impact, Risks and Mitigation, and 30/60/90-day Plan.",
  },
  creative: {
    simple: "Return one polished draft with a distinct voice and a concise revision note.",
    complex:
      "Return sections: Creative Direction, Draft Output, and Refinement Notes tied to voice, pacing, and structure.",
  },
  image: {
    simple:
      "Return a single production-ready image prompt with style, composition, and quality modifiers.",
    complex:
      "Return sections: Visual Intent, Primary Prompt, Negative Constraints, and Render Settings.",
  },
  study: {
    simple:
      "Return: weekly plan, daily focus blocks, practice method, and a progress check cadence.",
    complex:
      "Return sections: Baseline, Study Architecture, Weekly Schedule, Practice Framework, and Mastery Checkpoints.",
  },
  recommendation: {
    simple:
      "Return a ranked list with brief fit rationale and one alternative path if preferences differ.",
    complex:
      "Return sections: Criteria, Ranked Recommendations, Fit Rationale, Trade-offs, and Alternatives.",
  },
  comparison: {
    simple:
      "Return a comparison table plus a final recommendation with one-sentence rationale.",
    complex:
      "Return sections: Decision Criteria, Side-by-Side Analysis, Weighted Scoring, and Recommendation.",
  },
  explanation: {
    simple: "Return a plain-language explanation, one analogy, and one concrete example.",
    complex:
      "Return sections: Core Idea, First-Principles Walkthrough, Misconceptions, and Practical Example.",
  },
  tutorial: {
    simple: "Return clear steps with quick checks after major steps.",
    complex:
      "Return sections: Prerequisites, Step-by-Step Guide, Failure Recovery, and Final Validation.",
  },
  troubleshooting: {
    simple: "Return likely causes, ordered checks, and a safe first fix.",
    complex:
      "Return sections: Symptoms, Diagnostic Tree, Root Cause Validation, Fix Plan, and Post-fix Monitoring.",
  },
  general: {
    simple: "Return concise actionable guidance with clear next steps.",
    complex: "Return structured analysis, action plan, constraints, and clear success criteria.",
  },
};

const DOMAIN_QUALITY_BAR: Record<PromptType, string> = {
  coding:
    "Advice must be implementation-ready and testable; no generic statements.",
  research:
    "Claims must reflect evidence quality and clearly signal uncertainty.",
  business: "Recommendations must tie to measurable business outcomes.",
  creative: "Output must feel intentional, original, and stylistically coherent.",
  image: "Prompt must yield a coherent scene with high visual specificity.",
  study: "Plan must be realistic, measurable, and built for retention.",
  recommendation: "Recommendations must be justified with explicit fit logic.",
  comparison: "Conclusion must be defensible based on stated criteria.",
  explanation: "Explanation must be accurate, clear, and misconception-aware.",
  tutorial: "Steps must be executable and verifiable in sequence.",
  troubleshooting: "Flow must isolate cause and verify the fix reliably.",
  general: "Output must be specific, practical, and directly usable.",
};

const DOMAIN_DEFAULT_ASSUMPTION: Record<PromptType, string> = {
  coding:
    "Assume a modern TypeScript/JavaScript stack unless the user specifies otherwise.",
  research:
    "Assume the user wants credible sources and concise synthesis over opinion.",
  business:
    "Assume the user wants practical decisions tied to impact, not theory-heavy analysis.",
  creative:
    "Assume the user wants a polished first draft, not a rough outline.",
  image:
    "Assume the prompt will be used in a text-to-image model that benefits from precise style direction.",
  study:
    "Assume the learner is beginner-to-intermediate and can study consistently each week.",
  recommendation:
    "Assume the user prefers quality-filtered options over exhaustive lists.",
  comparison:
    "Assume the user needs a practical decision recommendation, not neutral summary only.",
  explanation:
    "Assume the audience is smart but not deeply technical in this topic.",
  tutorial:
    "Assume the user needs a stepwise path they can execute immediately.",
  troubleshooting:
    "Assume the system is currently failing and downtime or frustration matters.",
  general:
    "Assume the user wants the fastest path to a high-quality result.",
};

const DOMAIN_AUDIENCE: Record<PromptType, string> = {
  coding: "developer shipping production software",
  research: "researcher who needs evidence-backed conclusions",
  business: "operator and decision-maker accountable for measurable outcomes",
  creative: "creator who needs polished, publishable-quality output",
  image: "visual creator seeking precise art direction",
  study: "motivated learner at beginner-to-intermediate level",
  recommendation: "discerning user looking for high-fit curated options",
  comparison: "decision-maker evaluating practical options under constraints",
  explanation: "smart non-specialist learning a concept quickly",
  tutorial: "hands-on learner executing a task end-to-end",
  troubleshooting: "user resolving an active issue under time pressure",
  general: "user who wants clear next actions and usable output",
};

const DOMAIN_TONE: Record<PromptType, string> = {
  coding: "technical, concise, and implementation-first",
  research: "analytical, precise, and evidence-aware",
  business: "strategic, direct, and outcome-oriented",
  creative: "expressive but controlled, with clear artistic intent",
  image: "cinematic, specific, and composition-aware",
  study: "coaching-oriented, practical, and confidence-building",
  recommendation: "curatorial, opinionated, and fit-focused",
  comparison: "objective, structured, and decision-focused",
  explanation: "plain-language, accurate, and misconception-aware",
  tutorial: "stepwise, clear, and execution-focused",
  troubleshooting: "calm, diagnostic, and action-oriented",
  general: "professional, precise, and no-fluff",
};

const DOMAIN_FAILURE_MODES: Record<PromptType, string[]> = {
  coding: [
    "Do not ignore edge cases, error handling, or validation steps",
    "Do not propose breaking API-contract changes without explicit request",
  ],
  research: [
    "Do not present weak evidence as high-confidence conclusions",
    "Do not omit limitations or uncertainty boundaries",
  ],
  business: [
    "Do not provide strategy without measurable KPI linkage",
    "Do not ignore execution risk and operational constraints",
  ],
  creative: [
    "Do not produce generic or cliche language",
    "Do not lose voice consistency across the output",
  ],
  image: [
    "Do not use contradictory visual directions",
    "Do not omit key composition and lighting details",
  ],
  study: [
    "Do not provide unrealistic study loads that are hard to sustain",
    "Do not skip retention methods like retrieval and spaced repetition",
  ],
  recommendation: [
    "Do not return obvious low-fit suggestions",
    "Do not list options without fit rationale",
  ],
  comparison: [
    "Do not recommend without explicit criteria",
    "Do not hide trade-offs when ranking options",
  ],
  explanation: [
    "Do not overcomplicate with jargon without need",
    "Do not skip likely misconceptions",
  ],
  tutorial: [
    "Do not skip prerequisites and checkpoints",
    "Do not provide steps that cannot be validated",
  ],
  troubleshooting: [
    "Do not jump to fixes before symptom isolation",
    "Do not skip rollback/mitigation safeguards",
  ],
  general: [
    "Do not provide generic filler advice",
    "Do not leave next actions ambiguous",
  ],
};

export type QualityEvaluation = {
  passed: boolean;
  score: number;
  breakdown: ScoreBreakdown;
  issues: string[];
  wordCount: number;
  expansionRatio: number;
  coverageRatio: number;
  hasPlaceholders: boolean;
};

type DeterministicPromptBuildOptions = {
  input: string;
  type: PromptType;
  variant: VariantKey;
  complexity: PromptComplexity;
  intentSpec?: IntentSpec;
  safety?: SafetyAssessment;
};

type TopicSignals = {
  topic: string;
  timeframe: string | null;
  outputPreference: string | null;
  subject: string | null;
};

export function sanitizeInput(input: string): string {
  let sanitized = input.replace(/\0/g, "");
  sanitized = sanitized.replace(
    /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    "",
  );

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

export function classifyPromptType(
  input: string,
  style?: PromptStyle,
): PromptType {
  if (style && style !== "general" && STYLE_TO_TYPE[style]) {
    return STYLE_TO_TYPE[style];
  }

  const text = input.toLowerCase();

  if (
    /(python|typescript|javascript|api|refactor|bug|test|algorithm|database schema|edge case|code|function|class|method|compile|runtime|deploy)/i.test(
      text,
    )
  ) {
    return "coding";
  }

  if (
    /(literature review|citation|methodology|hypothesis|source analysis|peer-reviewed|research paper|academic|thesis|journal)/i.test(
      text,
    )
  ) {
    return "research";
  }

  if (
    /(revenue|kpi|roadmap|stakeholder|pricing|go-to-market|sales|operations|profit|market share|roi|business plan|startup)/i.test(
      text,
    )
  ) {
    return "business";
  }

  if (
    /(story|novel|poem|script|dialogue|character arc|worldbuilding|fiction|screenplay|narrative|plot|chapter)/i.test(
      text,
    )
  ) {
    return "creative";
  }

  if (
    /(render|camera|lighting|composition|midjourney|stable diffusion|cinematic shot|dall-e|image prompt|art style|visual prompt)/i.test(
      text,
    )
  ) {
    return "image";
  }

  const hasStudySignals =
    /(study plan|quiz|lesson|exam|memorize|learning objectives|syllabus|chapter|revision|board exam|class\s*\d+|grade\s*\d+|\b11th\b|\b12th\b)/i.test(
      text,
    ) ||
    (/(learn|master|improve|prepare)/i.test(text) &&
      /(math|mathematics|physics|chemistry|biology|history|geography|english|economics|subject)/i.test(
        text,
      ));
  if (hasStudySignals) return "study";

  if (
    /(recommend|suggest|similar to|movies? like|books? like|songs? like|shows? like|games? like|apps? like|looking for|i want something like|anything like|alternatives? to|best\s+\w+\s+for)/i.test(
      text,
    )
  ) {
    return "recommendation";
  }

  if (
    /(compare|versus|\bvs\b|difference between|differences between|which is better|better than|pros and cons|advantages|disadvantages)/i.test(
      text,
    )
  ) {
    return "comparison";
  }

  if (
    /(fix|error|not working|doesn'?t work|issue|problem with|debug|crash|broken|failing|won'?t|can'?t|stuck|troubleshoot)/i.test(
      text,
    )
  ) {
    return "troubleshooting";
  }

  if (
    /(how to|how can i|how do i|teach me|guide me|walk me through|steps to|tutorial|beginner|getting started|noob|newbie|step by step)/i.test(
      text,
    )
  ) {
    return "tutorial";
  }

  if (
    /(what is|what are|explain|define|meaning of|how does|how do\b.*\bwork|tell me about|describe|overview of|introduction to)/i.test(
      text,
    )
  ) {
    return "explanation";
  }

  return "general";
}

export function detectMissingDetails(input: string): MissingDetail[] {
  const text = input.toLowerCase();
  const missing: MissingDetail[] = [];

  if (
    !/(for\s+|audience|target\s+user|beginner|expert|team|student|customer)/i.test(
      text,
    )
  ) {
    missing.push("audience");
  }
  if (
    !/(tone|formal|casual|professional|friendly|concise|persuasive|technical)/i.test(
      text,
    )
  ) {
    missing.push("tone");
  }
  if (
    !/(format|table|json|bullet|markdown|list|outline|steps|sections)/i.test(text)
  ) {
    missing.push("format");
  }
  if (
    !/(length|words|paragraph|short|detailed|brief|under\s+\d+)/i.test(text)
  ) {
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

function normalizeIntentText(text: string): string {
  return text
    .replace(/\bleran\b/gi, "learn")
    .replace(/\bquicky\b/gi, "quickly")
    .replace(/\bteh\b/gi, "the")
    .replace(/\bnoob\b/gi, "beginner")
    .replace(/\bpls\b/gi, "please")
    .replace(/\bplz\b/gi, "please")
    .replace(/\bu\b/gi, "you")
    .replace(/,?\s*you know,?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEntities(input: string): string[] {
  const entities: string[] = [];

  const quoted = input.match(/["']([^"']{2,80})["']/g);
  if (quoted) {
    entities.push(...quoted.map((q) => q.replace(/["']/g, "").trim()));
  }

  const pairedMatch = input.match(
    /\b(the\s+)?([A-Z][a-zA-Z\s]+?)\s+and\s+([A-Z][a-zA-Z\s]+?)(?=[,.!?\s]|$)/,
  );
  if (pairedMatch) {
    entities.push(pairedMatch[2].trim(), pairedMatch[3].trim());
  }

  const likeMatch = input.match(/(?:like|similar to)\s+([^,.!?\n]{3,80})/gi);
  if (likeMatch) {
    for (const match of likeMatch) {
      const item = match.replace(/^(?:like|similar to)\s+/i, "").trim();
      if (item.length > 2) {
        entities.push(item);
      }
    }
  }

  return [...new Set(entities.filter((entity) => entity.length > 1))];
}

export function extractQualifiers(input: string): string[] {
  const descriptors = input.toLowerCase().match(
    /\b(romantic|emotional|funny|dark|scary|thrilling|action|adventure|horror|comedy|drama|sad|happy|intense|violent|peaceful|calm|exciting|mysterious|suspenseful|heartwarming|heartbreaking|inspirational|motivational|fast-paced|slow|epic|intimate|passionate|nostalgic|futuristic|historical|modern|classic|indie|mainstream|experimental|minimal|complex|simple|advanced|deep|light|heavy|professional|beginner|intermediate)\b/gi,
  );
  return [...new Set(descriptors ?? [])];
}

export function extractCoreTopic(input: string): string {
  const cleaned = normalizeIntentText(input);
  const stripped = cleaned
    .replace(
      /^(how to|how can i|how do i|teach me|guide me|walk me through|steps to|what is|what are|explain|define|tell me about|describe|i want|i need|help me|show me|give me)\s+/i,
      "",
    )
    .replace(/[.!?]+$/g, "")
    .trim();
  return stripped || cleaned;
}

export function detectSubDomain(input: string): string {
  const lower = input.toLowerCase();
  if (/(movie|film|watch|cinema|series|show|tv|netflix|drama|anime)/i.test(lower)) {
    return "film";
  }
  if (/(book|read|novel|author|manga|comic)/i.test(lower)) return "book";
  if (/(song|music|album|artist|playlist|band|listen)/i.test(lower)) return "music";
  if (/(game|gaming|play|steam|console|rpg|fps)/i.test(lower)) return "gaming";
  if (/(app|software|tool|saas|platform)/i.test(lower)) return "tech";
  if (/(food|restaurant|recipe|cook|eat|dish|cuisine)/i.test(lower)) return "food";
  if (/(python|javascript|typescript|react|node|css|html|code)/i.test(lower)) {
    return "programming";
  }
  if (/(math|physics|chemistry|biology|science)/i.test(lower)) return "science";
  if (/(business|marketing|startup|finance|investing)/i.test(lower)) return "business";
  return "general";
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function tokenizeForCoverage(text: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "we",
    "with",
    "you",
    "your",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function computeCoverageRatio(input: string, candidate: string): number {
  const inputTokens = [...new Set(tokenizeForCoverage(input))];
  if (inputTokens.length === 0) {
    return 1;
  }
  const candidateSet = new Set(tokenizeForCoverage(candidate));
  const covered = inputTokens.filter((token) => candidateSet.has(token)).length;
  return covered / inputTokens.length;
}

function toSentence(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function takeUnique(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of items) {
    const item = raw.trim();
    if (!item) {
      continue;
    }
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
    if (result.length >= max) {
      break;
    }
  }

  return result;
}

function shouldAddAssumption(input: string, intentSpec?: IntentSpec): boolean {
  if (intentSpec?.assumptions && intentSpec.assumptions.length > 0) {
    return false;
  }

  const normalized = normalizeWhitespace(input);
  const words = countWords(normalized);
  const hasContextSignals =
    /\b(for|with|using|about|in|at|by|from|deadline|audience|tone|format|budget|level)\b/i.test(
      normalized,
    ) || /\d/.test(normalized);

  if (words <= 8) {
    return true;
  }

  if (!hasContextSignals && /\b(this|it|something|stuff|quickly|fast|better)\b/i.test(normalized)) {
    return true;
  }

  return false;
}

function polishTopicForProse(coreTopic: string, type: PromptType): string {
  let topic = coreTopic;
  // Strip leading verb phrases that sound awkward when embedded in goal prose
  topic = topic
    .replace(/^(learn|study|master|improve|practice|understand|get better at|get good at)\s+/i, "")
    .replace(/^(fix|solve|debug|resolve|repair|handle)\s+/i, "")
    .replace(/^(grow|increase|boost|scale|maximize|optimize)\s+/i, "")
    .replace(/^(build|create|make|design|develop|write)\s+/i, "")
    .replace(/^(find|get|pick|choose|select)\s+/i, "")
    .trim();

  // Strip trailing adverbs that are already implied by the goal framing
  topic = topic.replace(/\s+(quickly|fast|rapidly|efficiently|effectively|better|well|easily)$/i, "").trim();

  // Strip possessives for more natural embedding
  topic = topic.replace(/^(my|our|the|their|his|her)\s+/i, "").trim();

  return topic || coreTopic;
}

function buildGoalText(input: string, type: PromptType, intentSpec?: IntentSpec, qualifiers?: string[]): string {
  if (intentSpec?.goal) {
    return toSentence(intentSpec.goal);
  }

  const coreTopic = extractCoreTopic(input);
  const topic = polishTopicForProse(coreTopic, type);
  const timeframe = extractTimeframeSignal(input);
  const qualifierHint = qualifiers && qualifiers.length > 0
    ? qualifiers.slice(0, 2).join(" and ")
    : null;

  const domainGoals: Partial<Record<PromptType, string>> = {
    study: `get genuinely strong at ${topic}${timeframe ? ` as fast as possible through consistent daily effort` : ""}${qualifierHint ? `, with a focus on ${qualifierHint} material` : ""}`,
    coding: `diagnose and fix the ${qualifierHint ? qualifierHint + " " : ""}problem with ${topic} using production-safe code`,
    business: `build a decision-ready plan for ${topic}${qualifierHint ? ` prioritizing ${qualifierHint} outcomes` : ""}`,
    creative: `produce a polished, publishable ${qualifierHint ?? "creative"} output for ${topic}`,
    research: `deliver rigorous, evidence-based analysis of ${topic}`,
    tutorial: `execute ${topic} step by step with confidence`,
    troubleshooting: `diagnose and resolve the issue with ${topic}${timeframe ? " under time pressure" : ""}`,
    recommendation: `find the best options for ${topic} that actually fit their needs`,
    comparison: `make a well-informed decision about ${topic}`,
    explanation: `deeply understand ${topic} from first principles`,
  };

  return toSentence(domainGoals[type] ?? `get a high-quality, actionable answer about ${topic}`);
}

function buildContextText(input: string, type: PromptType, intentSpec?: IntentSpec): string {
  if (intentSpec?.context) {
    return toSentence(intentSpec.context);
  }

  const audience = DOMAIN_AUDIENCE[type] ?? DOMAIN_AUDIENCE.general;
  const coreTopic = extractCoreTopic(input);
  const topic = polishTopicForProse(coreTopic, type);
  const goalRaw = buildGoalText(input, type).replace(/\.$/, "");

  return toSentence(`A ${audience} is working on ${topic} and needs to ${goalRaw.toLowerCase()}`);
}

function extractTimeframeSignal(input: string): string | null {
  const normalized = normalizeWhitespace(input.toLowerCase());
  const explicit = normalized.match(
    /(\d+\s*(?:hour|hours|day|days|week|weeks|month|months|year|years))/i,
  );
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  if (/\b(quick|quickly|fast|rapid|asap|urgent)\b/i.test(normalized)) {
    return "a fast timeline";
  }

  return null;
}

function extractOutputPreferenceSignal(input: string): string | null {
  const normalized = normalizeWhitespace(input.toLowerCase());

  if (/\b(table|matrix|grid)\b/i.test(normalized)) return "table";
  if (/\b(json|yaml|schema)\b/i.test(normalized)) return "json";
  if (/\b(step by step|steps|checklist)\b/i.test(normalized)) return "steps";
  if (/\b(plan|roadmap)\b/i.test(normalized)) return "plan";
  if (/\b(short|brief|concise)\b/i.test(normalized)) return "concise";

  return null;
}

function extractStudySubjectSignal(input: string): string | null {
  const normalized = normalizeWhitespace(input.toLowerCase());

  const subjectMap: Array<{ pattern: RegExp; subject: string }> = [
    { pattern: /\b(math|mathematics|algebra|geometry|calculus|trigonometry)\b/i, subject: "math" },
    { pattern: /\b(physics)\b/i, subject: "physics" },
    { pattern: /\b(chemistry)\b/i, subject: "chemistry" },
    { pattern: /\b(biology)\b/i, subject: "biology" },
    { pattern: /\b(history)\b/i, subject: "history" },
    { pattern: /\b(english|writing|grammar)\b/i, subject: "language" },
    { pattern: /\b(programming|coding|python|javascript|typescript|java)\b/i, subject: "programming" },
  ];

  for (const item of subjectMap) {
    if (item.pattern.test(normalized)) {
      return item.subject;
    }
  }

  return null;
}

function collectTopicSignals(input: string): TopicSignals {
  return {
    topic: extractCoreTopic(input),
    timeframe: extractTimeframeSignal(input),
    outputPreference: extractOutputPreferenceSignal(input),
    subject: extractStudySubjectSignal(input),
  };
}

function variantDepth(variant: VariantKey): number {
  if (variant === "max_pro") {
    return 3;
  }
  if (variant === "advanced") {
    return 2;
  }
  return 1;
}

type OpeningMode = "simple" | "analytical" | "creative" | "technical";

function stableHash(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickBySeed(options: string[], seed: string): string {
  if (options.length === 0) {
    return "";
  }
  return options[stableHash(seed) % options.length];
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function inferOpeningMode(type: PromptType, complexity: PromptComplexity): OpeningMode {
  if (type === "creative" || type === "image") {
    return "creative";
  }

  if (type === "coding" || type === "tutorial" || type === "troubleshooting") {
    return "technical";
  }

  if (type === "research" || type === "business" || type === "comparison") {
    return "analytical";
  }

  if (complexity === "complex") {
    return "analytical";
  }

  return "simple";
}

function buildSafetyOpening(options: {
  input: string;
  variant: VariantKey;
  type: PromptType;
  coreTopic: string;
  safeGoal: string;
}): string {
  const topic = lowerFirst(polishTopicForProse(options.coreTopic, options.type) || "the request");
  const safeGoal = lowerFirst(options.safeGoal.replace(/\.$/, ""));

  return pickBySeed(
    [
      `This request touches on ${topic}, so redirect it to a safe objective: ${safeGoal}.`,
      `Because the user asked about ${topic}, pivot to lawful guidance focused on ${safeGoal}.`,
      `Handle this safely: ${topic} appears in the request, and the right objective is to ${safeGoal}.`,
    ],
    `${options.input}|${options.variant}|${options.type}|${safeGoal}`,
  );
}

function buildOpeningSentence(options: {
  input: string;
  type: PromptType;
  variant: VariantKey;
  complexity: PromptComplexity;
  role: string;
  goal: string;
  coreTopic: string;
}): string {
  const seed = `${options.input}|${options.type}|${options.variant}`;
  const goal = options.goal.replace(/\.$/, "").trim();
  const lowerGoal = lowerFirst(goal);
  const topic = lowerFirst(polishTopicForProse(options.coreTopic, options.type) || "the request");
  const audience = DOMAIN_AUDIENCE[options.type] ?? DOMAIN_AUDIENCE.general;

  // The opening sentence always follows the role sentence, so it establishes
  // who the user is and what they need — never a generic opener.
  // Handle "user" (consonant Y-sound) and "operator" (vowel O-sound) correctly.
  const audienceLower = audience.toLowerCase();
  const needsAn = /^(a[^n\s]|e|i|o[^n\s]|un)/i.test(audienceLower) && !/^(user|uni)/i.test(audienceLower);
  const article = needsAn ? "An" : "A";

  return pickBySeed(
    [
      `${article} ${audience} wants to ${lowerGoal}.`,
      `${article} ${audience} needs to ${lowerGoal}.`,
      `${article} ${audience} is working on ${topic} and wants to ${lowerGoal}.`,
    ],
    seed,
  );
}

function buildConstraints(options: {
  type: PromptType;
  variant: VariantKey;
  intentSpec?: IntentSpec;
  safety?: SafetyAssessment;
}): string[] {
  const depth = variantDepth(options.variant);

  if (options.safety?.blocked) {
    const safeConstraints = [
      "Do not provide instructions that enable harm, abuse, or illegal activity.",
      "Keep guidance preventive, lawful, and safety-focused.",
      "If the user appears distressed, encourage immediate real-world support resources.",
      "Avoid operational details that could be misused.",
    ];
    return safeConstraints.slice(0, depth === 3 ? 4 : depth === 2 ? 3 : 2);
  }

  const fromSpec = takeUnique(options.intentSpec?.constraints ?? [], 4);
  const baseline = [
    "Avoid generic filler and repeated wording.",
    "Make recommendations specific and directly actionable.",
    "State assumptions briefly when key details are missing.",
    "Do not invent unsupported facts or guarantees.",
  ];

  const domainSpecific: Partial<Record<PromptType, string>> = {
    coding: "Preserve API contracts unless the user explicitly asks to change them.",
    business: "Tie recommendations to measurable impact and trade-offs.",
    study: "Keep schedule realistic for sustained consistency.",
    creative: "Avoid cliche phrasing and maintain a consistent voice.",
    research: "Differentiate evidence-backed claims from assumptions.",
  };

  const merged = takeUnique(
    [...fromSpec, ...(domainSpecific[options.type] ? [domainSpecific[options.type] as string] : []), ...baseline],
    depth === 3 ? 5 : depth === 2 ? 4 : 2,
  );

  return merged;
}

function buildInstructions(options: {
  input: string;
  type: PromptType;
  variant: VariantKey;
  complexity: PromptComplexity;
  intentSpec?: IntentSpec;
  safety?: SafetyAssessment;
  entities?: string[];
}): string[] {
  const depth = variantDepth(options.variant);

  if (options.safety?.blocked) {
    const safeSteps = [
      `Refocus the request toward this safe goal: ${options.safety.safeGoal}.`,
      "Explain risks at a high level without giving harmful operational details.",
      "Provide lawful alternatives, prevention strategies, and practical next steps.",
      "Keep the tone calm, respectful, and non-judgmental.",
      "When relevant, include trusted support resources or escalation paths.",
    ];
    return safeSteps.slice(0, depth === 3 ? 5 : depth === 2 ? 4 : 3);
  }

  const fromSpec = takeUnique(options.intentSpec?.must_include ?? [], 5).map((item) =>
    toSentence(item),
  );

  const topicSignals = collectTopicSignals(options.input);
  const entities = options.entities ?? [];

  const base = DOMAIN_FOCUS[options.type] ?? DOMAIN_FOCUS.general;
  // FIX 5: Cap stepCount to actual domain-specific instructions available — never pad with general.
  const rawStepCount =
    depth === 3 ? 7 : depth === 2 ? 6 : options.complexity === "complex" ? 4 : 3;

  const premium: string[] = [];
  if (options.type === "study") {
    const subjectCue = topicSignals.subject ? ` for ${topicSignals.subject}` : "";
    premium.push(
      `Start with a quick baseline diagnostic${subjectCue} to identify the highest-leverage weak areas.`,
      `Prioritize a fast-track sequence that combines concept review with daily retrieval drills${topicSignals.timeframe ? ` for ${topicSignals.timeframe}` : ""}.`,
      "Include concrete checkpoints to measure progress and adapt the plan if performance stalls.",
    );
  }

  if (options.type === "coding") {
    // FIX 7: Reference detected entities in instructions if domain-relevant.
    const entityHint = entities.length > 0
      ? ` (specifically addressing ${entities.slice(0, 2).join(" and ")} patterns such as state management, hooks, and component lifecycle where relevant)`
      : "";
    premium.push(
      `Request implementation-level reasoning${entityHint}, not abstract best-practice lists.`,
      "Ask for a minimal reproducible fix path before proposing larger refactors.",
      "Require explicit verification steps, including tests and failure-case checks.",
    );
  }

  if (options.type === "business") {
    premium.push(
      "Ask for a prioritization matrix by impact versus effort.",
      "Require one primary recommendation and one fallback strategy with trigger conditions.",
    );
  }

  if (depth === 3) {
    premium.push(
      "Every major recommendation must include a measurable success criterion.",
      "Include at least one explicit trade-off and when to choose each path.",
      "Reject vague language and replace it with concrete execution details.",
    );
  }

  const domainPool = [...fromSpec, ...premium, ...base];
  // FIX 5: Cap to available domain-specific instructions — never pad with DOMAIN_FOCUS.general.
  const stepCount = Math.min(rawStepCount, domainPool.length);

  return takeUnique(domainPool, stepCount).map((step) =>
    toSentence(step),
  );
}

function buildAssumption(input: string, type: PromptType, intentSpec?: IntentSpec): string | null {
  if (intentSpec?.assumptions && intentSpec.assumptions.length > 0) {
    return toSentence(intentSpec.assumptions[0]);
  }

  if (!shouldAddAssumption(input, intentSpec)) {
    return null;
  }

  return toSentence(DOMAIN_DEFAULT_ASSUMPTION[type] ?? DOMAIN_DEFAULT_ASSUMPTION.general);
}

function buildOutputFormat(type: PromptType, complexity: PromptComplexity): string {
  const format = DOMAIN_OUTPUT_FORMAT[type] ?? DOMAIN_OUTPUT_FORMAT.general;

  return complexity === "simple" ? format.simple : `${format.complex} Include section headers and concise bullets where helpful.`;
}

function buildQualityBar(type: PromptType, variant: VariantKey): string {
  const base = DOMAIN_QUALITY_BAR[type] ?? DOMAIN_QUALITY_BAR.general;
  if (variant === "max_pro") {
    // FIX 8: Domain-specific max_pro quality extension.
    const domainMaxPro: Partial<Record<PromptType, string>> = {
      coding: "Every code example must be production-safe, typed, and testable.",
      study: "Every week must have a measurable checkpoint and a defined done-state.",
      business: "Every recommendation must include a KPI, a risk, and a trigger for the fallback.",
      research: "Every claim must cite evidence strength and flag remaining uncertainty.",
      creative: "Every draft must sustain a consistent voice and justify structural choices.",
      comparison: "Every option must be scored against stated criteria with transparent weighting.",
      tutorial: "Every step must include a validation checkpoint and a recovery path if it fails.",
      troubleshooting: "Every diagnosis must be verifiable and every fix must include a rollback safeguard.",
      recommendation: "Every suggestion must include explicit fit rationale and a noted trade-off.",
      explanation: "Every concept must be grounded in a practical example and address the top misconception.",
      image: "Every prompt must specify composition, lighting, and style with no contradictory directions.",
    };
    const extension = domainMaxPro[type] ?? "Require measurable milestones, explicit trade-offs, and zero vague filler.";
    return `${base} ${extension}`;
  }
  if (variant === "advanced") {
    return `${base} Include at least one explicit success criterion.`;
  }
  return base;
}

function buildExpertiseHint(type: PromptType, variant: VariantKey, safety?: SafetyAssessment): string {
  if (safety?.blocked) {
    return "Use a safety-first, calm, and non-judgmental approach.";
  }

  const base = DOMAIN_ROLES[type] ?? "experienced specialist";
  if (variant === "max_pro") {
    return `Match the depth and judgment of an experienced ${base}.`;
  }
  if (variant === "advanced") {
    return `Use the practical rigor expected from an experienced ${base}.`;
  }
  return `Keep it practical and clear, like an experienced ${base}.`;
}

function buildAudienceText(type: PromptType, intentSpec?: IntentSpec): string {
  if (intentSpec?.audience) {
    return toSentence(intentSpec.audience);
  }

  return toSentence(DOMAIN_AUDIENCE[type] ?? DOMAIN_AUDIENCE.general);
}

function buildToneText(type: PromptType, intentSpec?: IntentSpec): string {
  if (intentSpec?.tone) {
    return toSentence(intentSpec.tone);
  }

  return toSentence(DOMAIN_TONE[type] ?? DOMAIN_TONE.general);
}

/**
 * Convert a DOMAIN_FOCUS instruction (imperative sentence) into a directive
 * fragment suitable for weaving into "Build them X, show them Y" prose.
 * Strips leading imperatives and transforms to noun-phrase or infinitive form.
 */
function toDirectiveFragment(instruction: string): string {
  let s = instruction.replace(/\.$/, "").trim();
  // Strip leading imperative verbs that don't work after "Build them ..."
  s = s
    .replace(/^(Ask for|Require|Include|Provide|Request|Use|Set|Specify|Avoid|Keep|Start with|Prioritize|Design for|Define|Frame|Differentiate|State|Surface|Anchor|Address|Cover|End with)\s+/i, (_, verb) => {
      const v = verb.toLowerCase();
      // For some verbs, rephrase to infinitive "a ..." or noun-phrase form
      if (v === "ask for" || v === "require" || v === "request") return "";
      if (v === "include" || v === "provide") return "";
      if (v === "use" || v === "design for" || v === "start with") return "";
      if (v === "keep" || v === "avoid") return "";
      if (v === "prioritize" || v === "anchor") return "";
      if (v === "frame" || v === "define") return "";
      if (v === "specify" || v === "set") return "";
      if (v === "differentiate" || v === "state" || v === "surface") return "";
      if (v === "cover" || v === "address") return "";
      if (v === "end with") return "";
      return "";
    })
    .trim();
  // Ensure we have something usable
  if (!s || s.length < 5) return instruction.replace(/\.$/, "").trim().toLowerCase();
  return s.toLowerCase();
}

/**
 * Build domain-specific woven instruction prose blocks.
 * Instead of mechanically prepending "Build them" to raw instruction sentences,
 * this produces natural directive prose per domain with failure modes embedded.
 */
function weaveInstructionProse(options: {
  type: PromptType;
  depth: number;
  topic: string;
  instructionTexts: string[];
  failureModes: string[];
  entities: string[];
}): string[] {
  const { type, depth, topic, instructionTexts, failureModes, entities } = options;
  const sentences: string[] = [];

  const failure0 = failureModes[0]?.replace(/^Do not /i, "never ").replace(/\.$/, "").toLowerCase() ?? "";
  const failure1 = (failureModes[1] ?? failureModes[0])?.replace(/^Do not /i, "never ").replace(/\.$/, "").toLowerCase() ?? "";
  const entityHint = entities.length > 0 ? entities.slice(0, 2).join(" and ") : null;

  // ── Domain-specific prose blocks ──
  // Each domain gets hand-crafted woven prose at each depth level
  // to match the "Build them X, show them Y — never Z" pattern.

  if (type === "study") {
    if (depth === 1) {
      sentences.push(
        `Build them a concrete week-by-week study structure, show them exactly which topics to attack first and why the order matters — ${failure0}.`,
      );
    } else if (depth === 2) {
      sentences.push(
        `Build them a concrete week-by-week study structure with daily focus blocks, and show them exactly which topics to attack first and why the order matters — ${failure0}.`,
      );
      sentences.push(
        `Include one explicit progress metric so they know the plan is working, and surface one scheduling trade-off they should decide on early.`,
      );
    } else {
      sentences.push(
        `Build them a concrete week-by-week study structure with daily focus blocks and retrieval practice baked in — ${failure0}.`,
      );
      sentences.push(
        `Show them exactly which topics to attack first, why the sequence matters, and how to self-test at each checkpoint — ${failure1}.`,
      );
      sentences.push(
        `Give them a clear baseline diagnostic and mastery criteria for each phase so they can adapt the plan if performance stalls.`,
      );
      sentences.push(
        `Finish with a verification checklist and an explicit done-state so they know when the work is complete.`,
      );
    }
    return sentences;
  }

  if (type === "coding" || type === "troubleshooting") {
    const techTopic = entityHint ?? topic;
    if (depth === 1) {
      sentences.push(
        `Start with root cause analysis of the ${techTopic} issue, then provide an exact fix with code — ${failure0}.`,
      );
    } else if (depth === 2) {
      sentences.push(
        `Start with root cause analysis of the ${techTopic} issue, provide an exact fix with code, and include a verification step the user can run immediately — ${failure0}.`,
      );
      sentences.push(
        `Include one explicit success criterion so they know the fix actually works, and surface one trade-off if the fix involves architectural choices.`,
      );
    } else {
      sentences.push(
        `Start with root cause analysis of the ${techTopic} issue before proposing any fix — ${failure0}.`,
      );
      sentences.push(
        `Provide an exact, minimal fix with production-ready code and explicit error handling — ${failure1}.`,
      );
      sentences.push(
        `Give them verification steps including a test case and a fallback if the fix does not resolve the root cause.`,
      );
      sentences.push(
        `Finish with a verification checklist and an explicit done-state so they know when the work is complete.`,
      );
    }
    return sentences;
  }

  if (type === "business") {
    if (depth === 1) {
      sentences.push(
        `Anchor every recommendation to a measurable KPI, and show them exactly which actions to prioritize by impact versus effort — ${failure0}.`,
      );
    } else if (depth === 2) {
      sentences.push(
        `Anchor every recommendation to a measurable KPI, show them exactly which actions to prioritize by impact versus effort, and surface the key risks — ${failure0}.`,
      );
      sentences.push(
        `Include one explicit success metric they can track this quarter, and surface one strategic trade-off they need to decide on before committing resources.`,
      );
    } else {
      sentences.push(
        `Anchor every recommendation to a measurable KPI and rank actions by impact versus execution effort — ${failure0}.`,
      );
      sentences.push(
        `Surface risks, dependencies, and stakeholder alignment issues explicitly — ${failure1}.`,
      );
      sentences.push(
        `Give them a primary recommendation and one fallback strategy with trigger conditions for when to switch.`,
      );
      sentences.push(
        `Finish with a verification checklist and an explicit done-state so they know when the work is complete.`,
      );
    }
    return sentences;
  }

  if (type === "comparison") {
    const comparisonTopic = entityHint ?? topic;
    if (depth === 1) {
      sentences.push(
        `Define comparison criteria before ranking ${comparisonTopic}, and finish with a clear recommendation stating where each option wins — ${failure0}.`,
      );
    } else if (depth === 2) {
      sentences.push(
        `Define weighted comparison criteria before ranking ${comparisonTopic}, show where each option wins and where it loses, and finish with a defensible recommendation — ${failure0}.`,
      );
      sentences.push(
        `Include one explicit decision metric and surface the top trade-off the user needs to resolve before committing.`,
      );
    } else {
      sentences.push(
        `Define weighted comparison criteria and score each option against them transparently — ${failure0}.`,
      );
      sentences.push(
        `Show exactly where each option wins, where it breaks down, and what the switching costs are — ${failure1}.`,
      );
      sentences.push(
        `Give them a final recommendation with stated confidence and a trigger condition for revisiting the decision.`,
      );
      sentences.push(
        `Finish with a verification checklist and an explicit done-state so they know when the work is complete.`,
      );
    }
    return sentences;
  }

  if (type === "creative") {
    if (depth === 1) {
      sentences.push(
        `Produce a polished draft with a clear voice and intentional pacing, and show them exactly how structural choices serve the piece — ${failure0}.`,
      );
    } else if (depth === 2) {
      sentences.push(
        `Produce a polished draft with a clear voice, intentional pacing, and structural intent, then show them how each choice serves the emotional arc — ${failure0}.`,
      );
      sentences.push(
        `Include one revision note tied to voice consistency, and surface one structural trade-off worth considering.`,
      );
    } else {
      sentences.push(
        `Produce a polished draft with a distinct, sustained voice and intentional pacing — ${failure0}.`,
      );
      sentences.push(
        `Show them exactly how structural choices serve the emotional arc and where the piece could strengthen — ${failure1}.`,
      );
      sentences.push(
        `Give them targeted revision notes tied to craft, not taste, so they can iterate with precision.`,
      );
      sentences.push(
        `Finish with a clear done-state defining what publishable quality looks like for this piece.`,
      );
    }
    return sentences;
  }

  if (type === "research") {
    if (depth === 1) {
      sentences.push(
        `Frame the research question clearly, synthesize the best available evidence, and flag limitations — ${failure0}.`,
      );
    } else if (depth === 2) {
      sentences.push(
        `Frame the research question, synthesize evidence with source-quality markers, and state limitations and confidence levels — ${failure0}.`,
      );
      sentences.push(
        `Include one explicit success criterion for evidence quality, and surface one methodological trade-off worth noting.`,
      );
    } else {
      sentences.push(
        `Frame the research question precisely and differentiate strong evidence from weak evidence — ${failure0}.`,
      );
      sentences.push(
        `Synthesize findings with explicit confidence levels and state limitations clearly — ${failure1}.`,
      );
      sentences.push(
        `Give them a concise actionable conclusion, not just a source list, so they can make a decision based on the synthesis.`,
      );
      sentences.push(
        `Finish with a verification checklist and an explicit done-state so they know when the work is complete.`,
      );
    }
    return sentences;
  }

  // ── Generic fallback for remaining types ──
  // Convert instructions to directive fragments and weave with failure modes.
  const frags = instructionTexts.slice(0, depth === 3 ? 3 : 2).map((t) => toDirectiveFragment(t));

  if (depth === 1 && frags.length >= 2) {
    sentences.push(
      `Build them ${frags[0]}, and show them exactly ${frags[1]} — ${failure0}.`,
    );
  } else if (depth === 2 && frags.length >= 2) {
    sentences.push(
      `Build them ${frags[0]}, and show them exactly ${frags[1]} — ${failure0}.`,
    );
    sentences.push(
      `Include one explicit success metric so they know it is working, and surface one key trade-off they should decide on before committing.`,
    );
  } else {
    if (frags[0]) {
      sentences.push(`Build them ${frags[0]} — ${failure0}.`);
    }
    if (frags[1]) {
      sentences.push(`Show them exactly ${frags[1]} — ${failure1}.`);
    }
    if (frags[2]) {
      sentences.push(`Give them ${frags[2]} so they can verify progress at every stage.`);
    }
    sentences.push(
      `Finish with a verification checklist and an explicit done-state so they know when the work is complete.`,
    );
  }

  return sentences;
}

function buildDeterministicPrompt(options: DeterministicPromptBuildOptions): string {
  const depth = variantDepth(options.variant);
  const role = DOMAIN_ROLES[options.type] ?? DOMAIN_ROLES.general;
  const assumption = buildAssumption(options.input, options.type, options.intentSpec);
  const topicSignals = collectTopicSignals(options.input);
  const failureModes = DOMAIN_FAILURE_MODES[options.type] ?? DOMAIN_FAILURE_MODES.general;
  const coreTopic = topicSignals.topic;
  const tone = DOMAIN_TONE[options.type] ?? DOMAIN_TONE.general;
  const audience = DOMAIN_AUDIENCE[options.type] ?? DOMAIN_AUDIENCE.general;
  const entities = extractEntities(options.input);
  const qualifiers = extractQualifiers(options.input);
  const goalRaw = buildGoalText(options.input, options.type, options.intentSpec, qualifiers).replace(/\.$/, "");
  const topic = polishTopicForProse(coreTopic, options.type);

  // Safety-blocked: produce a safe-redirect briefing
  if (options.safety?.blocked) {
    const sentences: string[] = [];
    sentences.push(
      buildSafetyOpening({
        input: options.input,
        variant: options.variant,
        type: options.type,
        coreTopic,
        safeGoal: options.safety.safeGoal,
      }),
    );
    sentences.push(`A user has asked about something that touches on ${coreTopic}, but the real need here is to ${options.safety.safeGoal}.`);
    sentences.push(`Explain the risks at a high level without giving harmful operational details, provide lawful alternatives and prevention strategies, and include trusted support resources where relevant.`);
    sentences.push(`Keep the tone calm, respectful, and non-judgmental — never preachy.`);
    sentences.push(`Do not provide instructions that enable harm, abuse, or illegal activity.`);
    return sentences.join(" ");
  }

  // ── Get raw instruction data ──
  const instructions = buildInstructions({ ...options, entities });
  const instructionTexts = instructions.map((s) => s.replace(/\.$/, ""));

  // ── Domain-specific anti-generic signal (FIX 1 Rule 2) ──
  const antiGeneric: Partial<Record<PromptType, string>> = {
    study: "They need a real plan that survives a busy schedule, not motivation.",
    coding: "No walkthroughs — they need an implementation-ready fix they can ship.",
    business: "Skip the framework theory — they need a decision they can execute this week.",
    creative: "No brainstorming lists — they need a single polished draft with real voice.",
    research: "No surface summaries — they need evidence-weighted synthesis with stated uncertainty.",
    tutorial: "No abstract overviews — they need steps they can execute and verify right now.",
    troubleshooting: "No generic checklists — they need a diagnosis path that isolates the root cause fast.",
    comparison: "No neutral both-are-great hedging — they need a defensible recommendation with trade-offs.",
    recommendation: "No obvious suggestions — they need curated options with clear fit rationale.",
    explanation: "No textbook dumps — they need the concept to click on first read.",
    image: "No vague moods — they need precise composition, lighting, and style direction.",
    general: "They need a concrete, specific answer — not a summary of possibilities.",
  };

  // ── Domain-specific closing line (FIX 1 Rule 5) ──
  const closingLines: Partial<Record<PromptType, string>> = {
    study: `Deliver this as direct coaching built for a learner who is serious about real progress, not just going through the motions.`,
    coding: `Deliver this as an engineer speaking to another engineer — precise, implementation-first, and testable.`,
    business: `Deliver this as a strategist briefing an operator — direct, outcome-anchored, and execution-ready.`,
    creative: `Deliver this as an editor who respects the craft — intentional, voice-aware, and never generic.`,
    research: `Deliver this as an analyst briefing a decision-maker — evidence-first, uncertainty-aware, and actionable.`,
    tutorial: `Deliver this as a senior instructor guiding a hands-on learner — stepwise, testable, and zero ambiguity.`,
    troubleshooting: `Deliver this as a senior SRE triaging a live issue — calm, diagnostic, and resolution-focused.`,
    comparison: `Deliver this as a decision scientist presenting to someone who needs to choose this week — structured, weighted, and conclusive.`,
    recommendation: `Deliver this as a trusted curator who has done the filtering — opinionated, justified, and fit-focused.`,
    explanation: `Deliver this as a gifted teacher who makes hard things click — plain language, accurate, and misconception-aware.`,
    image: `Deliver this as a veteran art director specifying a shot — cinematic, precise, and production-ready.`,
    general: `Deliver this as ${tone} guidance built for someone who wants the answer, not the preamble.`,
  };

  // ── Assemble the briefing ──
  const sentences: string[] = [];

  // Sentence 1: Always open with the role (FIX 1 Rule 1)
  sentences.push(`You are a ${role}.`);

  // Sentence 2: Who the user is and what they need
  sentences.push(
    buildOpeningSentence({
      input: options.input,
      type: options.type,
      variant: options.variant,
      complexity: options.complexity,
      role,
      goal: goalRaw,
      coreTopic,
    }),
  );

  // FIX 1 Rule 2: Domain-derived anti-generic signal (never the hardcoded universal)
  if (depth <= 2) {
    sentences.push(antiGeneric[options.type] ?? antiGeneric.general!);
  }

  // FIX 1 Rules 3-4: Woven instruction prose with failure modes embedded
  const wovenProse = weaveInstructionProse({
    type: options.type,
    depth,
    topic,
    instructionTexts,
    failureModes,
    entities,
  });
  sentences.push(...wovenProse);

  // Assumption if needed (natural, not labeled)
  if (assumption) {
    const cleanedAssumption = assumption.replace(/\.$/, "").replace(/^assume\s+/i, "").toLowerCase();
    sentences.push(`Where details are missing, assume ${cleanedAssumption}.`);
  }

  // Domain-specific measurable signal line
  const signalLines: Partial<Record<PromptType, string>> = {
    study: "Give them clear measurable signals so they know they are improving, not just busy.",
    coding: "Give them a way to verify the fix works before merging.",
    business: "Give them one leading indicator they can track this week to confirm momentum.",
    troubleshooting: "Give them a verification step to confirm the issue is actually resolved.",
  };
  if (signalLines[options.type] && depth >= 1) {
    sentences.push(signalLines[options.type]!);
  }

  // FIX 1 Rule 5: Sharp domain-specific closing line
  sentences.push(closingLines[options.type] ?? closingLines.general!);

  return sentences.join(" ");
}

export function buildHeuristicIntentSpec(options: {
  input: string;
  type: PromptType;
  complexity?: PromptComplexity;
  safety?: SafetyAssessment;
}): IntentSpec {
  const complexity = options.complexity ?? inferPromptComplexity(options.input);
  const safety = options.safety;
  const qualifiers = extractQualifiers(options.input);
  const goal = buildGoalText(options.input, options.type, undefined, qualifiers);
  const context = buildContextText(options.input, options.type);
  const audience = buildAudienceText(options.type);
  const tone = buildToneText(options.type);

  const constraints = buildConstraints({
    type: options.type,
    variant: complexity === "complex" ? "advanced" : "balanced",
    safety,
  });

  const mustInclude = takeUnique(
    [
      ...(DOMAIN_FOCUS[options.type] ?? DOMAIN_FOCUS.general),
      ...(complexity === "complex"
        ? ["Include measurable success criteria and checkpoints"]
        : ["Keep output concise and directly executable"]),
    ],
    5,
  );

  const mustAvoid = takeUnique(
    [
      ...(DOMAIN_FAILURE_MODES[options.type] ?? DOMAIN_FAILURE_MODES.general),
      "Avoid generic filler and repetitive phrasing",
    ],
    4,
  );

  const assumption = buildAssumption(options.input, options.type);

  return {
    goal,
    audience,
    context,
    constraints,
    tone,
    output_format: buildOutputFormat(options.type, complexity),
    must_include: mustInclude,
    must_avoid: mustAvoid,
    assumptions: assumption ? [assumption] : [],
  };
}

function detectRepetitionRatio(prompt: string): number {
  const lines = prompt
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length >= 24);
  if (lines.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  let repeated = 0;
  for (const value of counts.values()) {
    if (value > 1) {
      repeated += value - 1;
    }
  }

  return repeated / lines.length;
}

function countExecutionSignals(prompt: string): number {
  const checks = [
    /\b(core problem|objective|focus on|handle this request|treat this as|analyze)\b/i,
    /\b(wants?|needs?) (to|you to)\b/i,
    /\b(do not need|they do not|does not need)\b/i,
    /\b(deliver|provide|build|create|show|give|tell|resolve|analyze|treat)\b/i,
    /\b(never|avoid|do not|must not)\b/i,
    /\b(specific|concrete|measurable|precise|actionable)\b/i,
    /\b(sharp|dense|serious|commanding|confident|clear|practical)\b/i,
  ];

  return checks.reduce((score, check) => (check.test(prompt) ? score + 1 : score), 0);
}

export function inferPromptComplexity(input: string): PromptComplexity {
  const normalized = normalizeWhitespace(input);
  const words = countWords(normalized);
  const hasComplexSignals =
    /(compare|versus|\bvs\b|strategy|roadmap|end[-\s]?to[-\s]?end|from scratch|comprehensive|detailed|analyze|trade-?off|prioriti[sz]e|multi[-\s]?step|architecture|design plan|implementation plan)/i.test(
      normalized,
    ) ||
    ((normalized.includes(",") || normalized.includes("\n") || normalized.includes(";")) &&
      words >= 10);

  if (words >= 16 || hasComplexSignals) {
    return "complex";
  }

  // FIX 6: Domain-based complexity override — these domains always produce
  // substantial output regardless of input word count.
  const detectedType = classifyPromptType(normalized);
  const substantiveDomains: PromptType[] = ["study", "coding", "business", "research", "comparison"];
  if (substantiveDomains.includes(detectedType)) {
    return "complex";
  }

  return "simple";
}

export function assessSafety(input: string): SafetyAssessment {
  const normalized = normalizeWhitespace(input);
  const allowlisted = SAFETY_ALLOWLIST_PATTERN.test(normalized);
  const explicitExecutionIntent =
    /\b(how to|step by step|tutorial|guide|without getting caught|bypass|undetected|build|make|create)\b/i.test(
      normalized,
    );

  for (const rule of SAFETY_RULES) {
    if (!rule.pattern.test(normalized)) {
      continue;
    }

    if (allowlisted && !explicitExecutionIntent) {
      continue;
    }

    return {
      blocked: true,
      category: rule.category,
      reason: rule.reason,
      safeGoal: rule.safeGoal,
    };
  }

  return {
    blocked: false,
    safeGoal: "deliver safe and lawful guidance",
  };
}

export function buildDeterministicComposeOutput(options: {
  input: string;
  type: PromptType;
  intentSpec?: IntentSpec | null;
  safety?: SafetyAssessment;
}): DeterministicComposeOutput {
  const complexity = inferPromptComplexity(options.input);
  const intentSpec =
    options.intentSpec ??
    buildHeuristicIntentSpec({
      input: options.input,
      type: options.type,
      complexity,
      safety: options.safety,
    });
  const safety = options.safety;

  const balanced = buildDeterministicPrompt({
    input: options.input,
    type: options.type,
    variant: "balanced",
    complexity,
    intentSpec,
    safety,
  });

  const advanced = buildDeterministicPrompt({
    input: options.input,
    type: options.type,
    variant: "advanced",
    complexity: "complex",
    intentSpec,
    safety,
  });

  const maxPro = buildDeterministicPrompt({
    input: options.input,
    type: options.type,
    variant: "max_pro",
    complexity: "complex",
    intentSpec,
    safety,
  });

  const assumption = buildAssumption(options.input, options.type, intentSpec);
  const explanationParts = [
    `Detected ${options.type} intent with ${complexity} complexity and generated copy-paste-ready simple, advanced, and Max Pro variants with domain-specific structure.`,
    assumption ? `Added a minimal assumption: ${assumption}` : "No extra assumption was needed.",
    safety?.blocked
      ? `Unsafe intent was redirected to a safe alternative focused on ${safety.safeGoal}.`
      : "Applied domain-specific constraints, output format guidance, failure-mode prevention, and a clear quality bar.",
  ];

  return {
    balanced,
    advanced,
    max_pro: maxPro,
    explanation: explanationParts.join(" "),
  };
}

export function evaluateEngineeredPrompt(options: {
  prompt: string;
  input: string;
  variant: VariantKey;
  intentSpec?: IntentSpec;
  type?: string;
  complexity?: PromptComplexity;
}): QualityEvaluation {
  const normalizedPrompt = normalizeWhitespace(options.prompt);
  const normalizedInput = normalizeWhitespace(options.input);
  const issues: string[] = [];

  const promptWords = countWords(normalizedPrompt);
  const inputWords = Math.max(1, countWords(normalizedInput));
  const expansionRatio = promptWords / inputWords;
  const coverageRatio = computeCoverageRatio(normalizedInput, normalizedPrompt);
  const repetitionRatio = detectRepetitionRatio(normalizedPrompt);

  const complexity = options.complexity ?? inferPromptComplexity(normalizedInput);
  const profile =
    complexity === "simple"
      ? {
          balanced: {
            minWords: 24,
            maxWords: 220,
            minExpansionRatio: 0.65,
            minCoverageRatio: 0.16,
            minSignals: 2,
            passScore: 62,
          },
          advanced: {
            minWords: 48,
            maxWords: 320,
            minExpansionRatio: 0.9,
            minCoverageRatio: 0.16,
            minSignals: 3,
            passScore: 66,
          },
          max_pro: {
            minWords: 70,
            maxWords: 430,
            minExpansionRatio: 1.05,
            minCoverageRatio: 0.18,
            minSignals: 4,
            passScore: 72,
          },
        }
      : {
          balanced: {
            minWords: 58,
            maxWords: 340,
            minExpansionRatio: 0.85,
            minCoverageRatio: 0.22,
            minSignals: 3,
            passScore: 66,
          },
          advanced: {
            minWords: 96,
            maxWords: 500,
            minExpansionRatio: 1.1,
            minCoverageRatio: 0.22,
            minSignals: 4,
            passScore: 70,
          },
          max_pro: {
            minWords: 130,
            maxWords: 650,
            minExpansionRatio: 1.3,
            minCoverageRatio: 0.25,
            minSignals: 5,
            passScore: 76,
          },
        };

  const config = profile[options.variant];
  const maxRepetitionRatio = 0.3;
  const executionSignals = countExecutionSignals(normalizedPrompt);

  if (promptWords < config.minWords) {
    issues.push(`too_short_${options.variant}`);
  }
  if (promptWords > config.maxWords) {
    issues.push(`too_long_for_${complexity}_intent`);
  }
  if (expansionRatio < config.minExpansionRatio) {
    issues.push("insufficient_expansion");
  }
  if (coverageRatio < config.minCoverageRatio) {
    issues.push("insufficient_intent_coverage");
  }
  if (executionSignals < config.minSignals) {
    issues.push("weak_execution_structure");
  }
  if (repetitionRatio > maxRepetitionRatio) {
    issues.push("repetitive_or_boilerplate");
  }

  const matchedGenericPhrases = GENERIC_PHRASE_PATTERNS.filter((pattern) =>
    pattern.test(normalizedPrompt),
  );
  if (matchedGenericPhrases.length > 0) {
    issues.push("generic_phrase_detected");
  }

  const hasMetaOutputLanguage = META_OUTPUT_PATTERNS.some((pattern) =>
    pattern.test(normalizedPrompt),
  );
  if (hasMetaOutputLanguage) {
    issues.push("meta_output_detected");
  }

  const hasPlaceholders = PLACEHOLDER_PATTERNS.some((pattern) =>
    pattern.test(normalizedPrompt),
  );
  if (hasPlaceholders) {
    issues.push("contains_placeholders");
  }

  if (options.type && options.type !== "general") {
    const domainSignal = DOMAIN_VOCABULARY_SIGNALS[options.type];
    if (domainSignal && !domainSignal.test(normalizedPrompt)) {
      issues.push("domain_vocabulary_mismatch");
    }
  }

  if (options.intentSpec) {
    const intentNeedles = [
      options.intentSpec.goal,
      options.intentSpec.audience,
      options.intentSpec.tone,
      options.intentSpec.output_format,
      ...options.intentSpec.must_include,
    ]
      .join(" ")
      .trim();
    const specCoverage = computeCoverageRatio(intentNeedles, normalizedPrompt);
    if (specCoverage < 0.22) {
      issues.push("intent_spec_underrepresented");
    }
  }

  const headingCount = (normalizedPrompt.match(/^#{1,3}\s+/gm) ?? []).length;
  const bulletCount = (normalizedPrompt.match(/^\s*[-*]\s+/gm) ?? []).length;

  const clarity = clamp(
    7 +
      Math.round(coverageRatio * 8) +
      Math.min(6, executionSignals * 2) +
      (promptWords >= config.minWords ? 2 : 0),
    0,
    25,
  );
  const specificity = clamp(
    7 +
      Math.round(coverageRatio * 10) +
      Math.min(6, Math.floor(promptWords / 55)) +
      (options.type && options.type !== "general" ? 2 : 0) -
      (matchedGenericPhrases.length > 0 ? 4 : 0) -
      (hasMetaOutputLanguage ? 4 : 0),
    0,
    25,
  );
  const constraints = clamp(
    7 +
      (/\bnever\b/i.test(normalizedPrompt) ? 3 : 0) +
      (/\bdo not\b|\bavoid\b/i.test(normalizedPrompt) ? 3 : 0) +
      (/\b(ruthless|specific|measurable|concrete|precise)\b/i.test(
        normalizedPrompt,
      )
        ? 4
        : 0) +
      (/\bassume\b|\bwhere details\b/i.test(normalizedPrompt) ? 2 : 0),
    0,
    25,
  );
  const structure = clamp(
    7 +
      Math.min(8, executionSignals * 2) +
      Math.min(4, Math.floor(promptWords / 40)) +
      (/\b(core problem|objective|focus on|handle this request|treat this as)\b/i.test(
        normalizedPrompt,
      )
        ? 3
        : 0) -
      (repetitionRatio > maxRepetitionRatio ? 3 : 0),
    0,
    25,
  );

  const score = clamp(
    Math.round(((clarity + specificity + constraints + structure) / 100) * 100),
    0,
    100,
  );

  const passScore = config.passScore;
  const passed = issues.length === 0 && score >= passScore;

  return {
    passed,
    score,
    issues,
    wordCount: promptWords,
    expansionRatio,
    coverageRatio,
    hasPlaceholders,
    breakdown: { clarity, specificity, constraints, structure },
  };
}

export function runPipeline(
  input: string,
  style: PromptStyle = "general",
): PipelineResult {
  const sanitized = sanitizeInput(input);
  const type = classifyPromptType(sanitized, style);
  const missing = detectMissingDetails(sanitized);
  const entities = extractEntities(sanitized);
  const qualifiers = extractQualifiers(sanitized);
  const coreTopic = extractCoreTopic(sanitized);
  const subDomain = detectSubDomain(sanitized);

  return {
    sanitized,
    type,
    missing,
    entities,
    qualifiers,
    coreTopic,
    subDomain,
  };
}
