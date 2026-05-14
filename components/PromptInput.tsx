"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

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
  { value: "general", label: "Generate", icon: Sparkles },
];

const MIN_LENGTH = 4;
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
  }, [value]);

  // 3D tilt effect on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -3; // Max 3 degrees
    const rotateY = ((x - centerX) / centerX) * 3;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    card.style.setProperty("--mouse-x", `${(x / rect.width) * 100}%`);
    card.style.setProperty("--mouse-y", `${(y / rect.height) * 100}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  }, []);

  const canSubmit = value.trim().length >= MIN_LENGTH && value.trim().length <= MAX_LENGTH;

  const counterClassName = useMemo(() => {
    const length = value.length;
    if (length > MAX_LENGTH || length < MIN_LENGTH) return "text-score-low";
    if (length > MAX_LENGTH - 400) return "text-score-mid";
    return "text-text-secondary";
  }, [value.length]);

  return (
    <div className="space-y-5">
      {/* Main input card with 3D tilt */}
      <div
        ref={cardRef}
        className="card-3d relative overflow-hidden p-5 sm:p-6"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          borderColor: focused ? "var(--accent)" : undefined,
          boxShadow: focused
            ? "0 0 0 3px var(--accent-glow), 0 24px 80px rgba(0,0,0,0.45)"
            : undefined,
        }}
      >
        {/* Shine effect */}
        <div className="card-shine" />

        {/* Paste flash */}
        {pasteFlash ? (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "100%", opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-accent/15 to-transparent"
          />
        ) : null}

        {/* Label */}
        <label className="mb-4 block text-xs font-medium uppercase tracking-widest text-text-secondary">
          Input Material
        </label>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={() => {
            setPasteFlash(true);
            setTimeout(() => setPasteFlash(false), 650);
          }}
          placeholder="Paste source text, notes, code, or rough ideas..."
          className="input-float w-full"
          maxLength={MAX_LENGTH}
          minLength={MIN_LENGTH}
          style={{
            minHeight: "200px",
            background: "rgba(0, 0, 0, 0.15)",
          }}
        />

        {/* Character counter */}
        <div className="mt-3 flex justify-end">
          <span className={`font-mono text-xs tabular-nums ${counterClassName}`}>
            {value.length.toLocaleString()}/{MAX_LENGTH.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Style selector */}
      <div className="grid grid-cols-1 gap-2">
        {STYLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = style === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStyleChange(option.value)}
              className={`btn-liquid magnetic inline-flex h-11 items-center justify-center gap-2.5 rounded-xl border text-xs font-medium uppercase tracking-widest transition duration-200 ${
                active
                  ? "border-accent/40 bg-accent/10 text-accent shadow-[0_0_0_1px_var(--accent-glow)]"
                  : "border-border bg-surface text-text-secondary hover:text-text"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-accent" : ""}`} />
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Transform button — liquid fill effect */}
      <motion.button
        type="button"
        onClick={onTransform}
        disabled={!canSubmit || isStreaming}
        whileTap={{ scale: canSubmit && !isStreaming ? 0.96 : 1 }}
        className="btn-liquid btn-primary group relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-xl px-6 text-sm font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
        id="transform-btn"
      >
        {isStreaming ? (
          <>
            <span className="absolute inset-0 animate-loading-shimmer bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.18)_45%,transparent_100%)]" />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center gap-3"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
              <span className="text-white/90">
                Transforming{activeStage !== "idle" ? ` · ${activeStage}` : ""}
              </span>
            </motion.span>
          </>
        ) : (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="relative inline-flex items-center gap-2.5"
          >
            Transform
            <motion.span
              className="inline-flex text-white/70"
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
            >
              →
            </motion.span>
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
