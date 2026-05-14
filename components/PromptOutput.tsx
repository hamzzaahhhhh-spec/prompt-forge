"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Clipboard, FileCode2, FileJson2, FileText, Sparkles } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { ExplainPanel } from "@/components/ExplainPanel";
import { ScoreBadge } from "@/components/ScoreBadge";
import { VariantTabs } from "@/components/VariantTabs";
import type { TransformResponse, VariantKey } from "@/lib/types";

type PromptOutputProps = {
  inputText: string;
  result: TransformResponse | null;
  selectedPrompt: string;
  selectedVariant: VariantKey;
  compareView: boolean;
  streamPrompt: string;
  isStreaming: boolean;
  error: string | null;
  showExplain: boolean;
  onVariantChange: (key: VariantKey) => void;
  onToggleExplain: () => void;
};

export function PromptOutput({
  inputText,
  result,
  selectedPrompt,
  selectedVariant,
  compareView,
  streamPrompt,
  isStreaming,
  error,
  showExplain,
  onVariantChange,
  onToggleExplain,
}: PromptOutputProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const displayPrompt = useMemo(() => {
    if (result) return selectedPrompt;
    return streamPrompt;
  }, [result, selectedPrompt, streamPrompt]);

  // 3D tilt effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -2;
    const rotateY = ((x - centerX) / centerX) * 2;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    card.style.setProperty("--mouse-x", `${(x / rect.width) * 100}%`);
    card.style.setProperty("--mouse-y", `${(y / rect.height) * 100}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  }, []);

  const copyText = async (kind: "text" | "markdown" | "json") => {
    if (!result && !streamPrompt) return;

    let payload = displayPrompt;

    if (kind === "markdown") {
      payload = `### PromptForge Output\n\n\`\`\`\n${displayPrompt}\n\`\`\``;
    }

    if (kind === "json") {
      payload = JSON.stringify(
        {
          prompt: result?.prompt ?? displayPrompt,
          variants: result?.variants,
          score: result?.score,
          explanation: result?.explanation,
          type: result?.type,
          meta: result?.meta,
        },
        null,
        2,
      );
    }

    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={cardRef}
      className={`card-3d relative overflow-hidden p-5 sm:p-6 ${error ? "!border-score-low/50" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Shine effect */}
      <div className="card-shine" />

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.06),transparent_40%,rgba(124,58,237,0.03)_80%)]" />

      <div className="relative z-10 space-y-5">
        {/* Result header */}
        {result ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <VariantTabs
                value={selectedVariant}
                promptType={result.type}
                onChange={onVariantChange}
              />
              <ScoreBadge score={result.score} breakdown={result.breakdown} />
            </div>

            <div className="flex items-center gap-3">
              <div className="tag">
                <span className="tag-dot" />
                {result.meta.provider}
              </div>
              <span className="text-xs tabular-nums text-text-secondary">
                {result.meta.attempts} attempt{result.meta.attempts !== 1 ? "s" : ""} · {result.meta.inferenceMs}ms
              </span>
            </div>
          </div>
        ) : null}

        {/* Prompt display area */}
        <div className="relative min-h-[280px] rounded-2xl border border-border bg-black/20 p-5">
          {!displayPrompt && !isStreaming && !error ? (
            <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-border/60 text-center">
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm text-text-secondary">
                  Your transformed prompt will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="relative font-mono text-sm leading-7 text-text">
              <AnimatePresence mode="wait" initial={false}>
                {compareView && result ? (
                  <motion.div
                    key="compare"
                    initial={{ x: 16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -16, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  >
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-secondary">Before</p>
                      <p className="whitespace-pre-wrap text-text-secondary">{inputText}</p>
                    </div>
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-accent">After</p>
                      <p className="whitespace-pre-wrap">{displayPrompt}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.p
                    key={selectedVariant}
                    initial={{ x: 16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -16, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="whitespace-pre-wrap pr-4"
                  >
                    {displayPrompt}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Streaming indicator */}
              {isStreaming ? (
                <motion.span
                  className="pointer-events-none absolute bottom-0 left-0 top-0 w-[2px] bg-gradient-to-b from-transparent via-accent to-transparent"
                  animate={{ x: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                />
              ) : null}
            </div>
          )}

          {/* Error display */}
          {error ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-x-4 bottom-4 rounded-xl border border-score-low/40 bg-score-low/10 p-4 text-sm text-score-low backdrop-blur-sm"
            >
              {error}
            </motion.div>
          ) : null}
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => copyText("text")}
            className="btn-ghost btn-liquid magnetic inline-flex h-10 w-10 items-center justify-center rounded-xl transition duration-200"
            aria-label="Copy output"
            id="copy-btn"
          >
            {copied ? (
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="text-score-high"
              >
                <Check className="h-4 w-4" />
              </motion.span>
            ) : (
              <Clipboard className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleExplain}
            id="explain-btn"
            className={`btn-liquid magnetic inline-flex h-10 items-center rounded-xl border px-4 text-xs font-medium uppercase tracking-widest transition duration-200 ${
              showExplain
                ? "border-accent/40 bg-accent/10 text-accent"
                : "btn-ghost"
            }`}
          >
            Why it improved
          </button>
        </div>

        {/* Explain panel */}
        <ExplainPanel open={showExplain && Boolean(result?.explanation)} explanation={result?.explanation ?? ""} />

        {/* Export buttons */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { kind: "text" as const, icon: FileText, label: "Copy as Text" },
            { kind: "markdown" as const, icon: FileCode2, label: "Copy as Markdown" },
            { kind: "json" as const, icon: FileJson2, label: "Copy as JSON" },
          ].map(({ kind, icon: Icon, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => copyText(kind)}
              className="btn-ghost btn-liquid magnetic inline-flex h-11 items-center justify-center gap-2.5 rounded-xl text-xs font-medium uppercase tracking-widest transition duration-200"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Empty state notice */}
        {!result && !isStreaming && !error ? (
          <div className="rounded-xl border border-border/60 bg-surface/50 p-4 text-xs text-text-secondary">
            <div className="inline-flex items-center gap-2.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Transform-only engine enabled. PromptForge never answers pasted content.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
