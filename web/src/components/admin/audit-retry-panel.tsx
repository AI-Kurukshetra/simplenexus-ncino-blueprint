"use client";

import { useEffect, useEffectEvent, useState } from "react";

type QueueSummary = {
  unresolvedCount: number;
  oldestFailureAt: string | null;
  newestFailureAt: string | null;
  warningLevel: "ok" | "elevated" | "high" | "critical";
  warningMessage: string;
};

type RetryStats = {
  picked: number;
  retried: number;
  resolved: number;
  stillFailing: number;
};

function warningClass(level: QueueSummary["warningLevel"]) {
  if (level === "critical") return "text-rose-700";
  if (level === "high") return "text-amber-700";
  if (level === "elevated") return "text-sky-700";
  return "text-emerald-700";
}

export function AuditRetryPanel() {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "running" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<RetryStats | null>(null);

  async function loadSummary() {
    const response = await fetch("/api/admin/audit/retry", { cache: "no-store" });
    if (!response.ok) {
      setState("error");
      setMessage("Unable to load audit retry queue summary.");
      return;
    }

    const payload = await response.json();
    setSummary(payload?.data ?? null);
    setState("idle");
  }

  const loadSummaryOnMount = useEffectEvent(() => {
    void loadSummary();
  });

  useEffect(() => {
    loadSummaryOnMount();
  }, []);

  async function runRetry() {
    setState("running");
    setMessage(null);

    const response = await fetch("/api/admin/audit/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 100 }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to execute audit retry.");
      return;
    }

    setStats(payload?.data?.stats ?? null);
    setSummary(payload?.data?.summary ?? null);
    setMessage("Retry run completed.");
    setState("idle");
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit Retry Queue</h2>
          <p className="text-xs text-slate-500">
            Retry failed audit writes and monitor unresolved backlog.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runRetry()}
          disabled={state === "running" || state === "loading"}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run Retry
        </button>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Unresolved Failures" value={String(summary.unresolvedCount)} />
          <Metric
            label="Oldest Failure"
            value={summary.oldestFailureAt ? new Date(summary.oldestFailureAt).toLocaleString() : "-"}
          />
          <Metric
            label="Newest Failure"
            value={summary.newestFailureAt ? new Date(summary.newestFailureAt).toLocaleString() : "-"}
          />
        </div>
      ) : null}

      {summary ? (
        <p className={`text-sm ${warningClass(summary.warningLevel)}`}>{summary.warningMessage}</p>
      ) : null}

      {stats ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Retried {stats.retried} items. Resolved: {stats.resolved}. Still failing:{" "}
          {stats.stillFailing}.
        </div>
      ) : null}

      {state === "loading" ? <p className="text-sm text-slate-500">Loading summary...</p> : null}
      {state === "running" ? <p className="text-sm text-slate-500">Running retry...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">{message ?? "Unable to run retry."}</p>
      ) : null}
      {state === "idle" && message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </article>
  );
}
