"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

import type { ScoreBreakdown } from "@/lib/types";

type ScoreBadgeProps = {
  score: number;
  breakdown: ScoreBreakdown;
};

const CIRCUMFERENCE = 2 * Math.PI * 22;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const colorFor = (score: number) => {
  if (score >= 80) return "var(--score-high)";
  if (score >= 55) return "var(--score-mid)";
  return "var(--score-low)";
};

const glowFor = (score: number) => {
  if (score >= 80) return "0 0 20px rgba(34, 211, 165, 0.3)";
  if (score >= 55) return "0 0 20px rgba(245, 158, 11, 0.3)";
  return "0 0 20px rgba(239, 68, 68, 0.3)";
};

export function ScoreBadge({ score, breakdown }: ScoreBadgeProps) {
  const normalized = clamp(score);
  const progress = useMotionValue(0);
  const animatedScore = useTransform(progress, (value) => Math.round(value));
  const strokeOffset = useTransform(
    progress,
    (value) => CIRCUMFERENCE - (CIRCUMFERENCE * value) / 100,
  );

  useEffect(() => {
    const controls = animate(progress, normalized, {
      type: "spring",
      stiffness: 50,
      damping: 14,
      duration: 1.4,
    });

    return () => controls.stop();
  }, [normalized, progress]);

  return (
    <div className="group relative inline-flex items-center justify-center">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        className="-rotate-90"
        style={{ filter: glowFor(normalized) }}
      >
        <circle
          cx="32"
          cy="32"
          r="22"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
          fill="transparent"
        />
        <motion.circle
          cx="32"
          cy="32"
          r="22"
          stroke={colorFor(normalized)}
          strokeWidth="3"
          strokeLinecap="round"
          fill="transparent"
          style={{
            strokeDasharray: CIRCUMFERENCE,
            strokeDashoffset: strokeOffset,
          }}
        />
      </svg>

      <motion.span
        className="absolute text-sm font-bold tabular-nums text-text"
        style={{ letterSpacing: "-0.02em" }}
      >
        {animatedScore}
      </motion.span>

      {/* Tooltip */}
      <div className="pointer-events-none absolute -bottom-12 left-1/2 z-20 w-max -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] tabular-nums text-text-secondary opacity-0 shadow-card transition duration-200 group-hover:opacity-100">
        Clarity {breakdown.clarity}/25 · Specificity {breakdown.specificity}/25 · Constraints {breakdown.constraints}/25 · Structure {breakdown.structure}/25
      </div>
    </div>
  );
}
