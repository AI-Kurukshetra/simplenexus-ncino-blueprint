"use client";

import { useEffect, useState } from "react";

type Claim = {
  id: string;
  patientUserId: string;
  invoiceId?: string;
  claimNumber: string;
  status: string;
  payerName?: string;
  totalCents: number;
  submittedAt?: string;
  adjudicatedAt?: string;
  createdAt: string;
};

export function ClaimsTable() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  useEffect(() => {
    let active = true;

    fetch("/api/billing/claims", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load claims");
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setClaims((payload?.data?.claims ?? []) as Claim[]);
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

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Claims Queue</h2>
      <p className="text-xs text-slate-500">
        Placeholder claims visibility for Stage 4. Submission integrations come in a later phase.
      </p>

      {state === "loading" ? <p className="text-sm text-slate-500">Loading claims...</p> : null}
      {state === "error" ? <p className="text-sm text-rose-600">Unable to load claims.</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2 font-medium">Claim</th>
              <th className="px-2 py-2 font-medium">Invoice</th>
              <th className="px-2 py-2 font-medium">Patient</th>
              <th className="px-2 py-2 font-medium">Payer</th>
              <th className="px-2 py-2 font-medium">Amount</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Submitted</th>
              <th className="px-2 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium text-slate-900">{claim.claimNumber}</td>
                <td className="px-2 py-2 text-slate-600">{claim.invoiceId || "-"}</td>
                <td className="px-2 py-2 text-slate-600">{claim.patientUserId}</td>
                <td className="px-2 py-2 text-slate-700">{claim.payerName || "-"}</td>
                <td className="px-2 py-2 text-slate-700">${(claim.totalCents / 100).toFixed(2)}</td>
                <td className="px-2 py-2">
                  <Status status={claim.status} />
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {claim.submittedAt ? new Date(claim.submittedAt).toLocaleString() : "-"}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {new Date(claim.adjudicatedAt ?? claim.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {claims.length === 0 && state === "idle" ? (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-slate-500">
                  No claims found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Status({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "paid" || normalized === "accepted" || normalized === "adjudicated") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
        {status}
      </span>
    );
  }
  if (normalized === "rejected" || normalized === "denied" || normalized === "failed") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-800">{status}</span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{status}</span>
  );
}
