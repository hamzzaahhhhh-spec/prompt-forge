"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Clock3, Columns2, Sparkles } from "lucide-react";

import { HistoryPanel } from "@/components/HistoryPanel";
import { ModeSelector } from "@/components/ModeSelector";
import { PromptInput } from "@/components/PromptInput";
import { PromptOutput } from "@/components/PromptOutput";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { usePromptStore } from "@/lib/store";
import type {
  PromptMode,
  PromptStyle,
  StreamEvent,
  TransformResponse,
  VariantKey,
} from "@/lib/types";

const PAGE_STAGGER = 0.06;
const WELCOME_KEY = "promptforge:welcome-complete";

export default function Home() {
  const {
    compareView,
    error,
    historyOpen,
    inputText,
    isStreaming,
    mode,
    result,
    selectedVariant,
    showExplain,
    streamPrompt,
    style,
    clearError,
    hydrateHistory,
    setCompareView,
    setError,
    setHistoryOpen,
    setInputText,
    setIsStreaming,
    setMode,
    setResult,
    setSelectedVariant,
    setShowExplain,
    setStreamPrompt,
    setStyle,
  } = usePromptStore();

  const [activeStage, setActiveStage] = useState<string>("idle");
  const [isHydrated, setIsHydrated] = useState(false);
  const [welcomeState, setWelcomeState] = useState<"loading" | "visible" | "exiting" | "hidden">("loading");

  useEffect(() => {
    hydrateHistory();
  }, [hydrateHistory]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const seenWelcome = window.localStorage.getItem(WELCOME_KEY) === "1";
    setWelcomeState(seenWelcome ? "hidden" : "visible");
  }, []);

  const handleWelcomeContinue = useCallback(() => {
    if (welcomeState !== "visible") {
      return;
    }

    setWelcomeState("exiting");

    window.setTimeout(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WELCOME_KEY, "1");
      }
      setWelcomeState("hidden");
    }, 620);
  }, [welcomeState]);

  const welcomeVisible = welcomeState === "visible" || welcomeState === "exiting";

  const selectedPrompt = useMemo(() => {
    if (!result) {
      return "";
    }

    const variant = result.variants[selectedVariant] ?? result.prompt;
    if (!variant) {
      return result.prompt;
    }

    return variant;
  }, [result, selectedVariant]);

  const onTransform = useCallback(async () => {
    if (isStreaming || inputText.trim().length < 4) {
      return;
    }

    clearError();
    setIsStreaming(true);
    setActiveStage("starting");
    setStreamPrompt("");
    setResult(null);

    try {
      const response = await fetch("/api/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputText,
          mode,
          style,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? "Transform failed.");
      }

      if (!response.body) {
        throw new Error("No stream received from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as StreamEvent;

          if (event.event === "stage") {
            setActiveStage(event.stage);
            continue;
          }

          if (event.event === "result") {
            const payload = event.data as TransformResponse;
            setResult(payload, inputText);
            setSelectedVariant("balanced");
            setActiveStage("done");
            continue;
          }

          if (event.event === "error") {
            throw new Error(event.message);
          }
        }

        if (done) {
          break;
        }
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Unknown error.";
      setError(message);
      setActiveStage("error");
    } finally {
      setIsStreaming(false);
    }
  }, [
    clearError,
    inputText,
    isStreaming,
    mode,
    setError,
    setIsStreaming,
    setResult,
    setSelectedVariant,
    setStreamPrompt,
    style,
  ]);

  const onModeChange = useCallback(
    (nextMode: PromptMode) => {
      setMode(nextMode);
    },
    [setMode],
  );

  const onStyleChange = useCallback(
    (nextStyle: PromptStyle) => {
      setStyle(nextStyle);
    },
    [setStyle],
  );

  const onVariantChange = useCallback(
    (key: VariantKey) => {
      setSelectedVariant(key);
    },
    [setSelectedVariant],
  );

  if (!isHydrated) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {welcomeVisible ? (
          <WelcomeScreen
            isExiting={welcomeState === "exiting"}
            onContinue={handleWelcomeContinue}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        animate={{
          opacity: welcomeVisible ? 0.28 : 1,
          scale: welcomeVisible ? 0.986 : 1,
          // No filter:blur — it forces GPU compositing of the entire subtree,
          // which is catastrophic on mobile (causes 100+ ms frame drops).
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`relative pb-16 ${welcomeVisible ? "pointer-events-none select-none" : ""}`}
      >
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-surface/75 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 lg:h-20 lg:px-8">
          <button
            type="button"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-2 text-sm text-text-muted transition duration-150 hover:scale-[1.01] hover:text-text active:scale-[0.97]"
          >
            <Sparkles className="h-4 w-4 text-primary transition-transform duration-300 group-hover:rotate-12" />
            <span className="bg-gradient-to-r from-text via-primary to-accent bg-clip-text text-lg font-semibold text-transparent">
              PromptForge
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setCompareView(!compareView)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-medium uppercase tracking-[0.08em] transition duration-150 hover:scale-[1.01] active:scale-[0.97] ${
                compareView
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-surface/70 text-text-muted"
              }`}
            >
              <Columns2 className="h-4 w-4" />
              Compare
            </button>

            <ModeSelector mode={mode} onChange={onModeChange} />

            <Link
              href="/admin"
              className="inline-flex h-10 items-center rounded-full border border-border bg-surface/70 px-4 text-xs font-medium uppercase tracking-[0.08em] text-text-muted transition duration-150 hover:scale-[1.01] hover:text-text active:scale-[0.97]"
            >
              Admin
            </Link>

            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              aria-label="Open history"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/80 text-text-muted transition duration-150 hover:scale-[1.01] hover:bg-white/[0.06] hover:text-text active:scale-[0.97]"
            >
              <Clock3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.header>

      <main
        className="mx-auto w-full max-w-7xl px-3 pt-20 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28"
        style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-8 max-w-3xl">
          <h1 className="text-balance text-[clamp(28px,5vw,56px)] font-bold leading-[1.08] text-text">
            Paste any text. Forge a masterful AI prompt.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
            PromptForge transforms rough input into structured, high-quality prompts.
            It never answers your pasted content and always outputs prompt-ready text.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-10">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: PAGE_STAGGER, ease: "easeOut" }}
            className="lg:col-span-4"
          >
            <PromptInput
              value={inputText}
              style={style}
              onChange={setInputText}
              onStyleChange={onStyleChange}
              onTransform={onTransform}
              isStreaming={isStreaming}
              activeStage={activeStage}
            />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: PAGE_STAGGER + 0.08, ease: "easeOut" }}
            className="lg:col-span-6"
          >
            <PromptOutput
              inputText={inputText}
              result={result}
              selectedPrompt={selectedPrompt}
              selectedVariant={selectedVariant}
              compareView={compareView}
              streamPrompt={streamPrompt}
              isStreaming={isStreaming}
              error={error}
              showExplain={showExplain}
              onVariantChange={onVariantChange}
              onToggleExplain={() => setShowExplain(!showExplain)}
            />
          </motion.section>
        </div>
      </main>

      <HistoryPanel />
      </motion.div>
    </>
  );
}
