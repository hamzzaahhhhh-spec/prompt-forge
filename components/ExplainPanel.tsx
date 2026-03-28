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
          transition={{ height: { type: "spring", stiffness: 280, damping: 26 }, opacity: { delay: 0.08, duration: 0.2 } }}
          className="overflow-hidden"
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border bg-white/[0.02] p-4"
          >
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
              Why It Improved
            </p>
            <p className="mt-2 text-sm leading-7 text-text-muted">{explanation}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
