"use client";

import { motion } from "motion/react";
import { Cloud, Zap } from "lucide-react";

import type { PromptMode } from "@/lib/types";

type ModeSelectorProps = {
  mode: PromptMode;
  onChange: (mode: PromptMode) => void;
};

const OPTIONS: Array<{
  label: string;
  value: PromptMode;
  icon: React.ComponentType<{ className?: string }>;
}> =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_MODE === "true"
    ? [
        { label: "Local", value: "local", icon: Zap },
        { label: "Hosted", value: "hosted", icon: Cloud },
      ]
    : [{ label: "Hosted", value: "hosted", icon: Cloud }];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((option) => option.value === mode),
  );

  return (
    <div className="relative inline-flex h-10 items-center rounded-xl border border-border bg-surface/90 p-1">
      {/* Sliding indicator (liquid blob) */}
      {OPTIONS.length > 1 ? (
        <motion.div
          layoutId="mode-indicator"
          className="absolute inset-y-1 rounded-lg"
          style={{
            width: `calc(${100 / OPTIONS.length}% - 4px)`,
            background: "var(--accent)",
            opacity: 0.15,
            boxShadow: "0 0 20px var(--accent-glow)",
          }}
          animate={{ x: `${activeIndex * 100}%` }}
          transition={{ type: "spring", stiffness: 350, damping: 32 }}
        />
      ) : null}

      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = option.value === mode;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`magnetic relative z-10 inline-flex h-8 w-24 items-center justify-center gap-2 rounded-lg text-xs font-medium uppercase tracking-widest transition duration-200 sm:w-28 ${
              active ? "text-text" : "text-text-secondary hover:text-text"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 transition-colors duration-200 ${active ? "text-accent" : ""}`} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
