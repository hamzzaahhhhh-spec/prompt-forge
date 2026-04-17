"use client";

import { motion } from "motion/react";

import type { PromptType, VariantKey } from "@/lib/types";

type VariantTabsProps = {
  value: VariantKey;
  promptType: PromptType;
  onChange: (value: VariantKey) => void;
};

const TABS: Array<{ key: VariantKey; label: string }> = [
  { key: "balanced", label: "Simple" },
  { key: "advanced", label: "Advanced" },
  { key: "max_pro", label: "Max Pro" },
];

export function VariantTabs({ value, promptType, onChange }: VariantTabsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="relative flex items-center gap-1 rounded-full border border-border bg-white/[0.02] p-1">
        {TABS.map((tab) => {
          const active = tab.key === value;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative z-10 h-9 rounded-full px-4 text-xs font-medium uppercase tracking-[0.08em] transition duration-150 hover:scale-[1.01] active:scale-[0.97] ${
                active ? "text-text" : "text-text-muted"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="variant-underline"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/20"
                  transition={{ type: "spring", stiffness: 280, damping: 28 }}
                />
              ) : null}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {promptType}
      </div>
    </div>
  );
}
