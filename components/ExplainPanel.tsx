"use client";

import { AnimatePresence, motion } from "motion/react";

type ExplainPanelProps = {
  open: boolean;
  explanation: string;
};

export function ExplainPanel({ open, explanation }: ExplainPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="explain"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { type: "spring", stiffness: 300, damping: 28 },
            opacity: { delay: 0.08, duration: 0.25 },
          }}
          className="overflow-hidden"
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative rounded-xl border border-border bg-surface/50 p-5"
          >
            {/* Accent left border */}
            <div
              className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full"
              style={{
                background: "var(--accent)",
                boxShadow: "0 0 12px var(--accent-glow)",
              }}
            />

            <p className="pl-4 text-xs font-medium uppercase tracking-widest text-accent">
              Why It Improved
            </p>
            <p className="mt-3 pl-4 text-sm leading-7 text-text-secondary">
              {explanation}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
