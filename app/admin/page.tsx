"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

import type { AdminActivity, AdminSnapshot } from "@/lib/admin/types";

const ADMIN_KEY_STORAGE = "promptforge-admin-key";

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "2-digit",
  }).format(timestamp);
}

function statusTone(status: AdminActivity["status"]): string {
  switch (status) {
    case "success":
      return "text-score-high";
    case "rate_limited":
      return "text-score-mid";
    case "blocked":
      return "text-primary";
    default:
      return "text-score-low";
  }
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const existing = window.sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
    setAdminKey(existing);
    setDraftKey(existing);
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (!adminKey) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/stats", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
      });

      const payload = (await response.json()) as AdminSnapshot | { error?: { message?: string } };

      if (!response.ok) {
        throw new Error((payload as { error?: { message?: string } }).error?.message ?? "Admin auth failed.");
      }

      setSnapshot(payload as AdminSnapshot);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Admin request failed.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    void fetchSnapshot();

    const interval = window.setInterval(() => {
      void fetchSnapshot();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [adminKey, fetchSnapshot]);

  const saveKey = useCallback(() => {
    const normalized = draftKey.trim();
    setAdminKey(normalized);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ADMIN_KEY_STORAGE, normalized);
    }
  }, [draftKey]);

  const updateConfig = useCallback(
    async (next: { maintenanceMode?: boolean; forceLocalOnly?: boolean }) => {
      if (!adminKey) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/stats", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify(next),
        });

        const payload = (await response.json()) as AdminSnapshot | { error?: { message?: string } };
        if (!response.ok) {
          throw new Error((payload as { error?: { message?: string } }).error?.message ?? "Config update failed.");
        }

        setSnapshot(payload as AdminSnapshot);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Config update failed.");
      } finally {
        setSaving(false);
      }
    },
    [adminKey],
  );

  const cards = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      { label: "Total", value: snapshot.metrics.totalRequests },
      { label: "Success", value: snapshot.metrics.successRequests },
      { label: "Failed", value: snapshot.metrics.failedRequests },
      { label: "Rate Limited", value: snapshot.metrics.rateLimitedRequests },
      { label: "Blocked", value: snapshot.metrics.blockedRequests },
      { label: "Last Minute", value: snapshot.metrics.requestsLastMinute },
      { label: "Fallback Used", value: snapshot.metrics.fallbackCount },
    ];
  }, [snapshot]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="rounded-2xl border border-border bg-surface/90 p-5 shadow-soft sm:p-6"
      >
        <h1 className="text-3xl font-bold text-text">Admin Control Center</h1>
        <p className="mt-2 text-sm text-text-muted">
          Live operations, protection controls, and activity monitoring. Raw user content is never stored here.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            placeholder="Enter ADMIN_ACCESS_KEY"
            className="h-11 rounded-xl border border-border bg-black/20 px-3 text-sm text-text outline-none"
          />
          <button
            type="button"
            onClick={saveKey}
            className="h-11 rounded-xl border border-primary/60 bg-primary/15 px-5 text-xs font-medium uppercase tracking-[0.08em] text-primary"
          >
            Apply Key
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-score-low/60 bg-score-low/10 px-3 py-2 text-sm text-score-low">
            {error}
          </p>
        ) : null}

        {snapshot ? (
          <p className="mt-3 text-xs text-text-muted">
            Storage: {snapshot.security.activityStorage.toUpperCase()} | Cross-instance reliability:{" "}
            {snapshot.security.crossInstanceReliable ? "enabled" : "disabled"}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!snapshot || saving}
            onClick={() =>
              updateConfig({
                maintenanceMode: !snapshot?.config.maintenanceMode,
              })
            }
            className={`h-10 rounded-full border px-4 text-xs font-medium uppercase tracking-[0.08em] ${
              snapshot?.config.maintenanceMode
                ? "border-score-low/60 bg-score-low/15 text-score-low"
                : "border-border bg-surface text-text-muted"
            } disabled:opacity-40`}
          >
            {snapshot?.config.maintenanceMode ? "Disable" : "Enable"} Maintenance
          </button>

          <button
            type="button"
            disabled={!snapshot || saving}
            onClick={() =>
              updateConfig({
                forceLocalOnly: !snapshot?.config.forceLocalOnly,
              })
            }
            className={`h-10 rounded-full border px-4 text-xs font-medium uppercase tracking-[0.08em] ${
              snapshot?.config.forceLocalOnly
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-surface text-text-muted"
            } disabled:opacity-40`}
          >
            {snapshot?.config.forceLocalOnly ? "Disable" : "Enable"} Force Local Mode
          </button>

          <button
            type="button"
            disabled={!adminKey || loading}
            onClick={() => void fetchSnapshot()}
            className="h-10 rounded-full border border-border bg-surface px-4 text-xs font-medium uppercase tracking-[0.08em] text-text-muted disabled:opacity-40"
          >
            Refresh Now
          </button>
        </div>
      </motion.div>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface/90 p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{card.label}</p>
            <p className="mt-2 text-xl font-semibold text-text">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface/90 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">Recent Activity</h2>
          <p className="text-xs text-text-muted">
            {snapshot ? `Updated ${formatTime(snapshot.generatedAt)}` : "No data yet"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-text-muted">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Mode</th>
                <th className="py-2 pr-3">Style</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Latency</th>
                <th className="py-2 pr-3">Fallback</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.recentActivities ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-text-muted">{formatTime(item.timestamp)}</td>
                  <td className={`py-2 pr-3 font-medium ${statusTone(item.status)}`}>{item.status}</td>
                  <td className="py-2 pr-3 text-text-muted">
                    {item.requestedMode}{" -> "}{item.effectiveMode}
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{item.style}</td>
                  <td className="py-2 pr-3 text-text-muted">{item.type ?? "-"}</td>
                  <td className="py-2 pr-3 text-text-muted">{item.score ?? "-"}</td>
                  <td className="py-2 pr-3 text-text-muted">{item.latencyMs}ms</td>
                  <td className="py-2 pr-3 text-text-muted">{item.fallbackUsed ? "yes" : "no"}</td>
                  <td className="py-2 text-text-muted">{item.errorCode ?? "-"}</td>
                </tr>
              ))}

              {snapshot && snapshot.recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-text-muted">
                    No activity found yet. Trigger a transform request, then refresh.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
