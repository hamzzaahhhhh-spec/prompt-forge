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
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Tabs */}
      <div className="relative flex items-center gap-0.5 rounded-xl border border-border bg-surface/50 p-1">
        {TABS.map((tab) => {
          const active = tab.key === value;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`magnetic relative z-10 h-9 rounded-lg px-4 text-xs font-medium uppercase tracking-widest transition duration-200 ${
                active ? "text-text" : "text-text-secondary hover:text-text"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="variant-indicator"
                  className="absolute inset-0 -z-10 rounded-lg"
                  style={{
                    background: "var(--accent)",
                    opacity: 0.12,
                    boxShadow: "0 0 20px var(--accent-glow)",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              ) : null}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Type tag */}
      <div className="tag">
        <span className="tag-dot" />
        {promptType}
      </div>
    </div>
  );
}
