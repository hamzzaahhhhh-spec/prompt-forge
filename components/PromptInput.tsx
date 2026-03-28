"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Code2, ImagePlus, Lightbulb, Search, Sparkles } from "lucide-react";

import type { PromptStyle } from "@/lib/types";

type PromptInputProps = {
  value: string;
  style: PromptStyle;
  onChange: (value: string) => void;
  onStyleChange: (style: PromptStyle) => void;
  onTransform: () => void;
  isStreaming: boolean;
  activeStage: string;
};

const STYLE_OPTIONS: Array<{
  value: PromptStyle;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "general", label: "General", icon: Sparkles },
  { value: "code", label: "Code", icon: Code2 },
  { value: "research", label: "Research", icon: Search },
  { value: "business", label: "Business", icon: BriefcaseBusiness },
  { value: "creative", label: "Creative", icon: Lightbulb },
  { value: "image", label: "Image", icon: ImagePlus },
];

const MIN_LENGTH = 10;
const MAX_LENGTH = 8000;

export function PromptInput({
  value,
  style,
  onChange,
  onStyleChange,
  onTransform,
  isStreaming,
  activeStage,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.max(180, textareaRef.current.scrollHeight)}px`;
  }, [value]);

  const canSubmit = value.trim().length >= MIN_LENGTH && value.trim().length <= MAX_LENGTH;

  const counterClassName = useMemo(() => {
    const length = value.length;

    if (length > MAX_LENGTH || length < MIN_LENGTH) {
      return "text-score-low";
    }

    if (length > MAX_LENGTH - 400) {
      return "text-score-mid";
    }

    return "text-text-muted";
  }, [value.length]);

  return (
    <div className="space-y-4">
      <motion.div
        animate={{
          borderColor: focused ? "rgba(124, 110, 248, 0.72)" : "rgba(255,255,255,0.06)",
          boxShadow: focused
            ? "0 0 0 2px rgba(124,110,248,0.35), 0 24px 60px rgba(0,0,0,0.45)"
            : "0 12px 30px rgba(0,0,0,0.35)",
          backgroundColor: focused ? "rgba(17,17,24,0.98)" : "rgba(17,17,24,0.92)",
        }}
        transition={{ type: "spring", stiffness: 320, damping: 26, duration: 0.2 }}
        className="relative overflow-hidden rounded-2xl border p-4"
      >
        {pasteFlash ? (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "100%", opacity: 0.65 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        ) : null}

        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
          Input Material
        </label>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={() => {
            setPasteFlash(true);
            window.setTimeout(() => setPasteFlash(false), 650);
          }}
          placeholder="Paste source text, notes, code, or rough ideas..."
          className="w-full resize-none rounded-xl border border-border/80 bg-black/15 p-4 font-normal leading-[1.7] text-text outline-none placeholder:text-text-muted/60"
          maxLength={MAX_LENGTH}
          minLength={MIN_LENGTH}
        />

        <div className="mt-2 flex justify-end">
          <span className={`font-mono text-xs ${counterClassName}`}>
            {value.length}/{MAX_LENGTH}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STYLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = style === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStyleChange(option.value)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-medium uppercase tracking-[0.08em] transition duration-150 hover:scale-[1.01] active:scale-[0.97] ${
                active
                  ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(124,110,248,0.45)]"
                  : "border-border bg-surface text-text-muted hover:bg-white/[0.03]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-text-muted"}`} />
              {option.label}
            </button>
          );
        })}
      </div>

      <motion.button
        type="button"
        onClick={onTransform}
        disabled={!canSubmit || isStreaming}
        whileHover={{ scale: canSubmit && !isStreaming ? 1.01 : 1 }}
        whileTap={{ scale: canSubmit && !isStreaming ? 0.97 : 1 }}
        className="group relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isStreaming ? (
          <>
            <span className="absolute inset-0 animate-loading-shimmer bg-[linear-gradient(100deg,transparent_0%,rgba(255,255,255,0.22)_45%,transparent_100%)]" />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center gap-2"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
              Transforming {activeStage !== "idle" ? `(${activeStage})` : ""}
            </motion.span>
          </>
        ) : (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="relative inline-flex items-center gap-2"
          >
            Transform
            <motion.span
              initial={{ x: 0 }}
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="inline-flex"
            >
              {"->"}
            </motion.span>
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
