export type PromptMode = "local" | "hosted";

export type PromptStyle =
  | "general"
  | "code"
  | "research"
  | "business"
  | "creative"
  | "image";

export type PromptType =
  | "coding"
  | "research"
  | "business"
  | "creative"
  | "image"
  | "study"
  | "general";

export type VariantKey = "short" | "balanced" | "advanced";

export type ScoreBreakdown = {
  clarity: number;
  specificity: number;
  constraints: number;
  structure: number;
};

export type PromptVariants = Record<VariantKey, string>;

export type TransformResponse = {
  prompt: string;
  variants: string[];
  score: number;
  breakdown: ScoreBreakdown;
  explanation: string;
  type: PromptType;
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

export type StreamEvent =
  | { event: "stage"; stage: string; data?: unknown }
  | { event: "token"; token: string }
  | { event: "result"; data: TransformResponse }
  | { event: "error"; message: string }
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
  prompt: string;
  variants: PromptVariants;
  score: number;
  breakdown: ScoreBreakdown;
  explanation: string;
};
