"use client";

import { useEffect, useState } from "react";

type Policy = {
  cancellationMinHours: number;
  rescheduleMinHours: number;
};

export function SchedulingPolicyForm() {
  const [policy, setPolicy] = useState<Policy>({
    cancellationMinHours: 4,
    rescheduleMinHours: 8,
  });
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error" | "saved">(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/scheduling-policy", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const nextPolicy = payload?.data?.policy as Policy | undefined;
        if (nextPolicy) {
          setPolicy(nextPolicy);
        }
        setState("idle");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function savePolicy(formData: FormData) {
    const cancellationMinHours = Number(formData.get("cancellationMinHours") ?? 4);
    const rescheduleMinHours = Number(formData.get("rescheduleMinHours") ?? 8);

    setState("saving");
    setMessage(null);

    const response = await fetch("/api/admin/scheduling-policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationMinHours,
        rescheduleMinHours,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to save scheduling policy.");
      return;
    }

    setPolicy(payload?.data?.policy ?? { cancellationMinHours, rescheduleMinHours });
    setState("saved");
    setMessage("Scheduling policy updated.");
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Scheduling Policy</h2>
      <p className="text-xs text-slate-500">
        These windows apply to patient/provider cancel and reschedule actions. Admin can override.
      </p>

      <form action={savePolicy} className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Cancellation Window (hours)</span>
          <input
            type="number"
            min={0}
            max={168}
            name="cancellationMinHours"
            defaultValue={policy.cancellationMinHours}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Reschedule Window (hours)</span>
          <input
            type="number"
            min={0}
            max={168}
            name="rescheduleMinHours"
            defaultValue={policy.rescheduleMinHours}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={state === "saving" || state === "loading"}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Policy
        </button>
      </form>

      {state === "loading" ? <p className="text-sm text-slate-500">Loading policy...</p> : null}
      {state === "saving" ? <p className="text-sm text-slate-500">Saving policy...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">{message ?? "Unable to update policy."}</p>
      ) : null}
      {state === "saved" && message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}
