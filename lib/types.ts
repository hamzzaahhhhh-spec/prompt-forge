export type PromptMode = "local" | "hosted";

export type PromptStyle = "general";

export type PromptType =
  | "coding"
  | "research"
  | "business"
  | "creative"
  | "image"
  | "study"
  | "recommendation"
  | "comparison"
  | "explanation"
  | "tutorial"
  | "troubleshooting"
  | "general";

export type VariantKey = "balanced" | "advanced" | "max_pro";

export type ScoreBreakdown = {
  clarity: number;
  specificity: number;
  constraints: number;
  structure: number;
};

export type PromptVariants = Record<VariantKey, string>;

export type InferenceProvider = "huggingface" | "ollama";

export type TransformMeta = {
  provider: InferenceProvider;
  attempts: number;
  inferenceMs: number;
  qualityScore: number;
  qualityPassed: boolean;
  qualityIssues: string[];
  fallbackUsed?: boolean;
  fallbackReason?: string;
  requestId?: string;
};

export type TransformResponse = {
  prompt: string;
  variants: PromptVariants;
  score: number;
  breakdown: ScoreBreakdown;
  explanation: string;
  type: PromptType;
  meta: TransformMeta;
};

export type HistoryItem = {
  id: string;
  input: string;
  result: TransformResponse;
  timestamp: number;
};

export type TransformRequest = {
  text: string;
  mode: PromptMode;
  style?: PromptStyle;
};

export type StreamStage =
  | "sanitize"
  | "classify"
  | "intent_spec"
  | "compose"
  | "quality_gate"
  | "done";

export type StreamEvent =
  | { event: "stage"; stage: StreamStage; data?: unknown }
  | { event: "result"; data: TransformResponse }
  | { event: "error"; message: string; code?: string }
  | { event: "done" };

export type MissingDetail =
  | "audience"
  | "tone"
  | "format"
  | "length"
  | "constraints"
  | "output_type";

export type PipelineResult = {
  sanitized: string;
  type: PromptType;
  missing: MissingDetail[];
  entities: string[];
  qualifiers: string[];
  coreTopic: string;
  subDomain: string;
};
