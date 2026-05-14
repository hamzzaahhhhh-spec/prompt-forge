"use client";

import { AnimatePresence, motion } from "motion/react";
import { Clock3, RotateCcw, Trash2, X } from "lucide-react";

import { usePromptStore } from "@/lib/store";

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  }).format(timestamp);

export function HistoryPanel() {
  const {
    history,
    historyOpen,
    clearHistory,
    restoreFromHistory,
    setHistoryOpen,
  } = usePromptStore();

  return (
    <AnimatePresence>
      {historyOpen ? (
        <>
          {/* Backdrop */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setHistoryOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
            aria-label="Close history"
          />

          {/* Desktop panel */}
          <motion.aside
            initial={{ x: -340 }}
            animate={{ x: 0 }}
            exit={{ x: -340 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="fixed left-0 top-0 z-50 hidden h-full w-80 flex-col border-r border-border bg-surface/95 backdrop-blur-xl p-5 shadow-card lg:flex"
          >
            <HistoryContent
              history={history}
              onClose={() => setHistoryOpen(false)}
              onClear={clearHistory}
              onRestore={(id) => {
                restoreFromHistory(id);
                setHistoryOpen(false);
              }}
            />
          </motion.aside>

          {/* Mobile panel */}
          <motion.aside
            initial={{ y: 500 }}
            animate={{ y: 0 }}
            exit={{ y: 500 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-50 h-[75vh] rounded-t-3xl border border-border bg-surface/95 backdrop-blur-xl p-5 shadow-card lg:hidden"
          >
            {/* Drag handle */}
            <div className="mb-4 flex justify-center">
              <div className="h-1 w-8 rounded-full bg-border" />
            </div>
            <HistoryContent
              history={history}
              onClose={() => setHistoryOpen(false)}
              onClear={clearHistory}
              onRestore={(id) => {
                restoreFromHistory(id);
                setHistoryOpen(false);
              }}
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

type HistoryContentProps = {
  history: ReturnType<typeof usePromptStore.getState>["history"];
  onClose: () => void;
  onClear: () => void;
  onRestore: (id: string) => void;
};

function HistoryContent({ history, onClose, onClear, onRestore }: HistoryContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5 text-sm font-semibold text-text">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
            <Clock3 className="h-3.5 w-3.5 text-accent" />
          </div>
          Prompt History
        </div>

        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClear}
            className="btn-ghost magnetic inline-flex h-8 w-8 items-center justify-center rounded-lg transition duration-200"
            aria-label="Clear history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost magnetic inline-flex h-8 w-8 items-center justify-center rounded-lg transition duration-200"
            aria-label="Close history"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* History items with staggered animation */}
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-5 text-center text-sm text-text-secondary">
            No saved prompts yet.
          </div>
        ) : (
          history.map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onRestore(item.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.06,
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="group w-full rounded-xl border border-border bg-surface/50 p-3.5 text-left transition duration-300 hover:border-accent/30 hover:bg-accent/5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-text-secondary">
                  {formatDate(item.timestamp)}
                </span>
                <div className="tag">
                  <span className="tag-dot" />
                  {item.result.type}
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-text">{item.input.slice(0, 80)}</p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <RotateCcw className="h-3 w-3" />
                Restore
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}
