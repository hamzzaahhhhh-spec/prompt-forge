"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Clock3, Columns2, Sparkles } from "lucide-react";

import { CustomCursor } from "@/components/CustomCursor";
import { ScrollProgress } from "@/components/ScrollProgress";
import { LoadingScreen } from "@/components/LoadingScreen";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ModeSelector } from "@/components/ModeSelector";
import { PromptInput } from "@/components/PromptInput";
import { PromptOutput } from "@/components/PromptOutput";
import { usePromptStore } from "@/lib/store";
import type {
  PromptMode,
  PromptStyle,
  StreamEvent,
  TransformResponse,
  VariantKey,
} from "@/lib/types";

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
  const [showLoading, setShowLoading] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrateHistory();
  }, [hydrateHistory]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Check if user has seen loading screen
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(WELCOME_KEY) === "1";
    if (seen) setShowLoading(false);
  }, []);

  // Nav scroll detection
  useEffect(() => {
    const onScroll = () => {
      setNavScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hero text word-by-word reveal with IntersectionObserver
  useEffect(() => {
    if (!heroRef.current) return;
    const words = heroRef.current.querySelectorAll(".word");
    if (!words.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            words.forEach((word, i) => {
              setTimeout(() => {
                (word as HTMLElement).style.transform = "translateY(0)";
                (word as HTMLElement).style.opacity = "1";
              }, i * 80);
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(heroRef.current);

    return () => observer.disconnect();
  }, [isHydrated, showLoading]);

  const handleLoadingComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WELCOME_KEY, "1");
    }
    setShowLoading(false);
  }, []);

  const selectedPrompt = (() => {
    if (!result) return "";
    const variant = result.variants[selectedVariant] ?? result.prompt;
    return variant || result.prompt;
  })();

  const onTransform = useCallback(async () => {
    if (isStreaming || inputText.trim().length < 4) return;

    clearError();
    setIsStreaming(true);
    setActiveStage("starting");
    setStreamPrompt("");
    setResult(null);

    try {
      const response = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, mode, style }),
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
          if (!line.trim()) continue;

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

        if (done) break;
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
    (nextMode: PromptMode) => setMode(nextMode),
    [setMode],
  );

  const onStyleChange = useCallback(
    (nextStyle: PromptStyle) => setStyle(nextStyle),
    [setStyle],
  );

  const onVariantChange = useCallback(
    (key: VariantKey) => setSelectedVariant(key),
    [setSelectedVariant],
  );

  if (!isHydrated) return null;

  // Split hero text into words for animation
  const heroWords = "Paste any text.\nForge a masterful\nAI prompt.".split(/(\s+)/);

  return (
    <>
      {/* ── Custom cursor ── */}
      <CustomCursor />

      {/* ── Scroll progress bar ── */}
      <ScrollProgress />

      {/* ── Loading screen ── */}
      <AnimatePresence>
        {showLoading ? (
          <LoadingScreen onComplete={handleLoadingComplete} />
        ) : null}
      </AnimatePresence>

      {/* ── Main app ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showLoading ? 0 : 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* ═══════ NAVIGATION ═══════ */}
        <header
          className={`nav-glass fixed inset-x-0 top-0 z-40 ${navScrolled ? "scrolled" : ""}`}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:h-18 sm:px-6 lg:h-20 lg:px-8">
            {/* Logo */}
            <button
              type="button"
              className="magnetic group inline-flex items-center gap-2.5"
              id="nav-logo"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20 transition-all duration-300 group-hover:bg-accent/20 group-hover:ring-accent/40">
                <Sparkles className="h-4 w-4 text-accent" />
              </span>
              <span className="text-lg font-bold tracking-tight text-text">
                Prompt<span className="text-accent">Forge</span>
              </span>
            </button>

            {/* Nav actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setCompareView(!compareView)}
                id="nav-compare"
                className={`btn-ghost btn-liquid magnetic inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-medium uppercase tracking-widest transition duration-200 ${
                  compareView
                    ? "!border-accent/40 !bg-accent/10 !text-accent"
                    : ""
                }`}
              >
                <Columns2 className="h-4 w-4" />
                <span className="hidden sm:inline">Compare</span>
              </button>

              <ModeSelector mode={mode} onChange={onModeChange} />

              <Link
                href="/admin"
                id="nav-admin"
                className="btn-ghost btn-liquid magnetic inline-flex h-10 items-center rounded-xl px-4 text-xs font-medium uppercase tracking-widest transition duration-200"
              >
                Admin
              </Link>

              <button
                type="button"
                onClick={() => setHistoryOpen(!historyOpen)}
                aria-label="Open history"
                id="nav-history"
                className="btn-ghost btn-liquid magnetic inline-flex h-10 w-10 items-center justify-center rounded-xl transition duration-200"
              >
                <Clock3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ═══════ HERO SECTION ═══════ */}
        <main
          className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
          style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="pt-32 sm:pt-36 lg:pt-44">
            {/* Hero headline — word by word reveal */}
            <div className="mb-16 max-w-4xl" ref={heroRef}>
              <h1 className="text-hero leading-[0.95]">
                {heroWords.map((word, i) =>
                  word === "\n" ? (
                    <br key={`br-${i}`} />
                  ) : word.trim() === "" ? (
                    <span key={`space-${i}`}> </span>
                  ) : (
                    <span key={`word-${i}`} className="inline-block overflow-hidden">
                      <span
                        className="word inline-block"
                        style={{
                          transform: "translateY(100%)",
                          opacity: 0,
                          transition: `transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                        }}
                      >
                        {word}
                      </span>
                    </span>
                  ),
                )}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="mt-8 max-w-2xl text-body text-text-secondary"
              >
                PromptForge transforms rough input into structured, high-quality prompts.
                It never answers your pasted content — always outputs prompt-ready text.
              </motion.p>
            </div>

            {/* ═══════ WORKSPACE GRID ═══════ */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-10 lg:gap-8">
              {/* Input card */}
              <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 1.4,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
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

              {/* Output card */}
              <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 1.5,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
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
          </div>
        </main>

        <HistoryPanel />
      </motion.div>
    </>
  );
}
