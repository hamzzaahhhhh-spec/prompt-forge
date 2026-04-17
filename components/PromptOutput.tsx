"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Clipboard, FileCode2, FileJson2, FileText, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

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

  const displayPrompt = useMemo(() => {
    if (result) {
      return selectedPrompt;
    }

    return streamPrompt;
  }, [result, selectedPrompt, streamPrompt]);

  const copyText = async (kind: "text" | "markdown" | "json") => {
    if (!result && !streamPrompt) {
      return;
    }

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
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-surface/90 p-5 shadow-soft sm:p-6 ${error ? "border-score-low/70" : "border-border"}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(124,110,248,0.18),transparent_35%,rgba(62,207,207,0.09)_80%)]" />

      <div className="relative z-10 space-y-5">
        {result ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <VariantTabs
                value={selectedVariant}
                promptType={result.type}
                onChange={onVariantChange}
              />

              <ScoreBadge score={result.score} breakdown={result.breakdown} />
            </div>

            <p className="text-xs text-text-muted">
              Provider {result.meta.provider} · Attempts {result.meta.attempts} · Inference{" "}
              {result.meta.inferenceMs}ms
            </p>
          </div>
        ) : null}

        <div className="relative min-h-[260px] rounded-xl border border-border bg-black/20 p-4">
          {!displayPrompt && !isStreaming && !error ? (
            <div className="flex h-[230px] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-text-muted">
              Your transformed prompt will appear here
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
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  >
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.08em] text-text-muted">Before</p>
                      <p className="whitespace-pre-wrap text-text-muted">{inputText}</p>
                    </div>
                    <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.08em] text-primary">After</p>
                      <p className="whitespace-pre-wrap">{displayPrompt}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.p
                    key={selectedVariant}
                    initial={{ x: 16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -16, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-pre-wrap pr-4"
                  >
                    {displayPrompt}
                  </motion.p>
                )}
              </AnimatePresence>

              {isStreaming ? (
                <motion.span
                  className="pointer-events-none absolute bottom-0 left-0 top-0 w-[1px] bg-gradient-to-b from-transparent via-primary to-transparent"
                  animate={{ x: [0, 8, 0] }}
                  transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: "linear" }}
                />
              ) : null}
            </div>
          )}

          {error ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute inset-x-3 bottom-3 rounded-lg border border-score-low/60 bg-score-low/10 p-3 text-sm text-score-low"
            >
              {error}
            </motion.div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => copyText("text")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition duration-150 hover:scale-[1.01] hover:bg-white/[0.05] hover:text-text active:scale-[0.97]"
            aria-label="Copy output"
          >
            {copied ? (
              <motion.span
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
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
            className={`inline-flex h-10 items-center rounded-full border px-4 text-xs font-medium uppercase tracking-[0.08em] transition duration-150 hover:scale-[1.01] active:scale-[0.97] ${
              showExplain
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-border bg-surface text-text-muted"
            }`}
          >
            Why it improved
          </button>
        </div>

        <ExplainPanel open={showExplain && Boolean(result?.explanation)} explanation={result?.explanation ?? ""} />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => copyText("text")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-xs font-medium uppercase tracking-[0.08em] text-text-muted transition duration-150 hover:scale-[1.01] hover:bg-white/[0.04] hover:text-text active:scale-[0.97]"
          >
            <FileText className="h-3.5 w-3.5" />
            Copy as Text
          </button>
          <button
            type="button"
            onClick={() => copyText("markdown")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-xs font-medium uppercase tracking-[0.08em] text-text-muted transition duration-150 hover:scale-[1.01] hover:bg-white/[0.04] hover:text-text active:scale-[0.97]"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Copy as Markdown
          </button>
          <button
            type="button"
            onClick={() => copyText("json")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-xs font-medium uppercase tracking-[0.08em] text-text-muted transition duration-150 hover:scale-[1.01] hover:bg-white/[0.04] hover:text-text active:scale-[0.97]"
          >
            <FileJson2 className="h-3.5 w-3.5" />
            Copy as JSON
          </button>
        </div>

        {!result && !isStreaming && !error ? (
          <div className="rounded-xl border border-border/80 bg-white/[0.02] p-3 text-xs text-text-muted">
            <div className="inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Transform-only engine enabled. PromptForge never answers pasted content.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
