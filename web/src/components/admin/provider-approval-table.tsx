"use client";

import { useEffect, useState } from "react";

type Provider = {
  id: string;
  fullName: string;
  email: string;
  specialty: string;
  licenseNumber: string;
  yearsExperience: string;
  approvalStatus: "pending" | "approved" | "rejected";
};

export function ProviderApprovalTable() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");

  async function load(nextFilter = filter, showLoading = true) {
    if (showLoading) setState("loading");

    const response = await fetch(`/api/admin/providers?status=${nextFilter}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = await response.json();
    setProviders(payload?.data?.providers ?? []);
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/admin/providers?status=pending", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setProviders(payload?.data?.providers ?? []);
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

  async function update(providerUserId: string, decision: "approved" | "rejected") {
    const response = await fetch("/api/admin/providers/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerUserId, decision }),
    });

    if (response.status === 409) {
      await load(filter, false);
      return;
    }

    if (!response.ok) {
      setState("error");
      return;
    }

    await load(filter, false);
  }

  function onFilterChange(value: "pending" | "approved" | "rejected" | "all") {
    setFilter(value);
    void load(value);
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Provider Verification Queue</h2>
        <select
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value as "pending" | "approved" | "rejected" | "all")
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {state === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">Unable to load or update providers.</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Email</th>
              <th className="px-2 py-2 font-medium">Specialty</th>
              <th className="px-2 py-2 font-medium">License</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id} className="border-b border-slate-100">
                <td className="px-2 py-2">{provider.fullName}</td>
                <td className="px-2 py-2 text-slate-600">{provider.email}</td>
                <td className="px-2 py-2 text-slate-700">{provider.specialty}</td>
                <td className="px-2 py-2 text-slate-700">{provider.licenseNumber}</td>
                <td className="px-2 py-2">
                  <Status status={provider.approvalStatus} />
                </td>
                <td className="px-2 py-2">
                  {provider.approvalStatus === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => update(provider.id, "approved")}
                        className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => update(provider.id, "rejected")}
                        className="rounded-md bg-rose-700 px-2 py-1 text-xs text-white hover:bg-rose-800"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No actions</span>
                  )}
                </td>
              </tr>
            ))}
            {providers.length === 0 && state === "idle" ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
                  No providers in this queue.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Status({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-800">
        Rejected
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
      Pending
    </span>
  );
}
