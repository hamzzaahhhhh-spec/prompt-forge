"use client";

import { create } from "zustand";

import type {
  HistoryItem,
  PromptMode,
  PromptStyle,
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

const defaultMode: PromptMode =
  process.env.NEXT_PUBLIC_DEFAULT_MODE === "local" ? "local" : "hosted";

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
  setMode: (mode) => set({ mode }),
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

    const historyItem: HistoryItem = {
      id: isBrowser() && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
      input: input ?? get().inputText,
      result,
      timestamp: Date.now(),
    };

    const nextHistory = [historyItem, ...get().history].slice(0, MAX_HISTORY_ITEMS);
    persistHistory(nextHistory);

    set({
      result,
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

      const parsed = JSON.parse(raw) as HistoryItem[];
      if (!Array.isArray(parsed)) {
        return;
      }

      set({ history: parsed.slice(0, MAX_HISTORY_ITEMS) });
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
