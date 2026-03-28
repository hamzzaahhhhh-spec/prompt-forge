"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

import type { ScoreBreakdown } from "@/lib/types";

type ScoreBadgeProps = {
  score: number;
  breakdown: ScoreBreakdown;
};

const CIRCUMFERENCE = 2 * Math.PI * 20;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const colorFor = (score: number) => {
  if (score >= 80) {
    return "#22D3A5";
  }

  if (score >= 55) {
    return "#F59E0B";
  }

  return "#EF4444";
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
      stiffness: 60,
      damping: 12,
      duration: 1.2,
    });

    return () => controls.stop();
  }, [normalized, progress]);

  return (
    <div className="group relative inline-flex items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle
          cx="28"
          cy="28"
          r="20"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="4"
          fill="transparent"
        />
        <motion.circle
          cx="28"
          cy="28"
          r="20"
          stroke={colorFor(normalized)}
          strokeWidth="4"
          strokeLinecap="round"
          fill="transparent"
          style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: strokeOffset }}
        />
      </svg>

      <motion.span className="absolute text-sm font-semibold text-text">
        {animatedScore}
      </motion.span>

      <div className="pointer-events-none absolute -bottom-10 left-1/2 z-10 w-max -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-muted opacity-0 shadow-soft transition duration-150 group-hover:opacity-100">
        Clarity {breakdown.clarity}/25 · Specificity {breakdown.specificity}/25 · Constraints {breakdown.constraints}/25 · Structure {breakdown.structure}/25
      </div>
    </div>
  );
}
