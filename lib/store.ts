"use client";

import { create } from "zustand";

import type {
  HistoryItem,
  PromptMode,
  PromptVariants,
  PromptStyle,
  TransformMeta,
  TransformResponse,
  VariantKey,
} from "@/lib/types";

type PromptStore = {
  inputText: string;
  mode: PromptMode;
  style: PromptStyle;
  isStreaming: boolean;
  streamPrompt: string;
  result: TransformResponse | null;
  error: string | null;
  selectedVariant: VariantKey;
  showExplain: boolean;
  compareView: boolean;
  historyOpen: boolean;
  history: HistoryItem[];
  clearError: () => void;
  setInputText: (value: string) => void;
  setMode: (mode: PromptMode) => void;
  setStyle: (style: PromptStyle) => void;
  setIsStreaming: (value: boolean) => void;
  setStreamPrompt: (next: string | ((prev: string) => string)) => void;
  setResult: (result: TransformResponse | null, input?: string) => void;
  setError: (message: string | null) => void;
  setSelectedVariant: (variant: VariantKey) => void;
  setShowExplain: (open: boolean) => void;
  setCompareView: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  hydrateHistory: () => void;
  clearHistory: () => void;
  restoreFromHistory: (id: string) => void;
};

const HISTORY_KEY = "promptforge-history";
const MAX_HISTORY_ITEMS = 50;

const isBrowser = () => typeof window !== "undefined";

const localModeEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === "true";
const requestedDefaultMode: PromptMode =
  process.env.NEXT_PUBLIC_DEFAULT_MODE === "local" ? "local" : "hosted";
const defaultMode: PromptMode =
  localModeEnabled && requestedDefaultMode === "local" ? "local" : "hosted";

function normalizeMeta(meta: unknown, score: number): TransformMeta {
  if (!meta || typeof meta !== "object") {
    return {
      provider: "huggingface",
      attempts: 0,
      inferenceMs: 0,
      qualityScore: score,
      qualityPassed: true,
      qualityIssues: [],
    };
  }

  const candidate = meta as Partial<TransformMeta>;
  return {
    provider:
      candidate.provider === "ollama" || candidate.provider === "huggingface"
        ? candidate.provider
        : "huggingface",
    attempts: typeof candidate.attempts === "number" ? candidate.attempts : 0,
    inferenceMs: typeof candidate.inferenceMs === "number" ? candidate.inferenceMs : 0,
    qualityScore:
      typeof candidate.qualityScore === "number" ? candidate.qualityScore : score,
    qualityPassed:
      typeof candidate.qualityPassed === "boolean" ? candidate.qualityPassed : true,
    qualityIssues: Array.isArray(candidate.qualityIssues)
      ? candidate.qualityIssues.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeVariants(variants: unknown, prompt: string): PromptVariants {
  if (Array.isArray(variants)) {
    return {
      balanced:
        typeof variants[1] === "string" && variants[1].trim().length > 0
          ? variants[1]
          : prompt,
      advanced:
        typeof variants[2] === "string" && variants[2].trim().length > 0
          ? variants[2]
          : prompt,
      max_pro:
        typeof variants[3] === "string" && variants[3].trim().length > 0
          ? variants[3]
          : typeof variants[2] === "string" && variants[2].trim().length > 0
            ? variants[2]
            : prompt,
    };
  }

  if (variants && typeof variants === "object") {
    const next = variants as Partial<Record<VariantKey, unknown>>;
    return {
      balanced:
        typeof next.balanced === "string" && next.balanced.trim().length > 0
          ? next.balanced
          : prompt,
      advanced:
        typeof next.advanced === "string" && next.advanced.trim().length > 0
          ? next.advanced
          : prompt,
      max_pro:
        typeof next.max_pro === "string" && next.max_pro.trim().length > 0
          ? next.max_pro
          : typeof next.advanced === "string" && next.advanced.trim().length > 0
            ? next.advanced
            : prompt,
    };
  }

  return {
    balanced: prompt,
    advanced: prompt,
    max_pro: prompt,
  };
}

function normalizeResult(result: unknown): TransformResponse | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const candidate = result as Partial<TransformResponse> & {
    variants?: unknown;
    meta?: unknown;
  };

  const prompt = typeof candidate.prompt === "string" ? candidate.prompt : "";
  if (!prompt) {
    return null;
  }

  const score = typeof candidate.score === "number" ? candidate.score : 0;
  const breakdown =
    candidate.breakdown &&
    typeof candidate.breakdown.clarity === "number" &&
    typeof candidate.breakdown.specificity === "number" &&
    typeof candidate.breakdown.constraints === "number" &&
    typeof candidate.breakdown.structure === "number"
      ? candidate.breakdown
      : {
          clarity: 0,
          specificity: 0,
          constraints: 0,
          structure: 0,
        };

  return {
    prompt,
    variants: normalizeVariants(candidate.variants, prompt),
    score,
    breakdown,
    explanation: typeof candidate.explanation === "string" ? candidate.explanation : "",
    type: candidate.type ?? "general",
    meta: normalizeMeta(candidate.meta, score),
  };
}

const persistHistory = (history: HistoryItem[]) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const usePromptStore = create<PromptStore>((set, get) => ({
  inputText: "",
  mode: defaultMode,
  style: "general",
  isStreaming: false,
  streamPrompt: "",
  result: null,
  error: null,
  selectedVariant: "balanced",
  showExplain: false,
  compareView: false,
  historyOpen: false,
  history: [],
  clearError: () => set({ error: null }),
  setInputText: (value) => set({ inputText: value }),
  setMode: (mode) => {
    if (!localModeEnabled && mode === "local") {
      set({ mode: "hosted" });
      return;
    }
    set({ mode });
  },
  setStyle: (style) => set({ style }),
  setIsStreaming: (value) => set({ isStreaming: value }),
  setStreamPrompt: (next) =>
    set((state) => ({
      streamPrompt: typeof next === "function" ? next(state.streamPrompt) : next,
    })),
  setResult: (result, input) => {
    if (!result) {
      set({ result: null });
      return;
    }
    const normalized = normalizeResult(result);
    if (!normalized) {
      return;
    }

    const historyItem: HistoryItem = {
      id: isBrowser() && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
      input: input ?? get().inputText,
      result: normalized,
      timestamp: Date.now(),
    };

    const nextHistory = [historyItem, ...get().history].slice(0, MAX_HISTORY_ITEMS);
    persistHistory(nextHistory);

    set({
      result: normalized,
      history: nextHistory,
      showExplain: false,
    });
  },
  setError: (message) => set({ error: message }),
  setSelectedVariant: (variant) => set({ selectedVariant: variant }),
  setShowExplain: (open) => set({ showExplain: open }),
  setCompareView: (open) => set({ compareView: open }),
  setHistoryOpen: (open) => set({ historyOpen: open }),
  hydrateHistory: () => {
    if (!isBrowser()) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Array<Partial<HistoryItem>>;
      if (!Array.isArray(parsed)) {
        return;
      }

      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const result = normalizeResult(item.result);
          if (!result) {
            return null;
          }

          return {
            id: typeof item.id === "string" ? item.id : `${Date.now()}`,
            input: typeof item.input === "string" ? item.input : "",
            timestamp: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
            result,
          } satisfies HistoryItem;
        })
        .filter((item): item is HistoryItem => Boolean(item))
        .slice(0, MAX_HISTORY_ITEMS);

      set({ history: normalized });
    } catch {
      set({ history: [] });
    }
  },
  clearHistory: () => {
    if (isBrowser()) {
      window.localStorage.removeItem(HISTORY_KEY);
    }

    set({ history: [] });
  },
  restoreFromHistory: (id) => {
    const entry = get().history.find((item) => item.id === id);
    if (!entry) {
      return;
    }

    set({
      inputText: entry.input,
      result: entry.result,
      streamPrompt: "",
      error: null,
      selectedVariant: "balanced",
      showExplain: false,
    });
  },
}));
