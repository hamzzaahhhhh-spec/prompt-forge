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
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHistoryOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            aria-label="Close history"
          />

          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed left-0 top-0 z-50 hidden h-full w-80 flex-col border-r border-border bg-surface/95 p-4 shadow-soft lg:flex"
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

          <motion.aside
            initial={{ y: 420 }}
            animate={{ y: 0 }}
            exit={{ y: 420 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 h-[75vh] rounded-t-2xl border border-border bg-surface/95 p-4 shadow-soft lg:hidden"
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
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-text">
          <Clock3 className="h-4 w-4 text-primary" />
          Prompt History
        </div>

        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition duration-150 hover:scale-[1.01] hover:text-text active:scale-[0.97]"
            aria-label="Clear history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition duration-150 hover:scale-[1.01] hover:text-text active:scale-[0.97]"
            aria-label="Close history"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
            No saved prompts yet.
          </div>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRestore(item.id)}
              className="w-full rounded-xl border border-border bg-white/[0.02] p-3 text-left transition duration-150 hover:scale-[1.01] hover:border-primary/50 active:scale-[0.97]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted">{formatDate(item.timestamp)}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {item.result.type}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-text">{item.input.slice(0, 60)}</p>
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
