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
    <div className="relative inline-flex h-10 items-center rounded-full border border-border bg-surface/90 p-1">
      {OPTIONS.length > 1 ? (
        <motion.div
          layoutId="mode-indicator"
          className="absolute inset-y-1 rounded-full bg-primary/20"
          style={{ width: `calc(${100 / OPTIONS.length}% - 4px)` }}
          animate={{ x: `${activeIndex * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
            className={`relative z-10 inline-flex h-8 w-24 items-center justify-center gap-2 rounded-full text-xs font-medium uppercase tracking-[0.08em] transition duration-150 hover:scale-[1.01] active:scale-[0.97] sm:w-28 ${
              active ? "text-text" : "text-text-muted"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-text-muted"}`} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
