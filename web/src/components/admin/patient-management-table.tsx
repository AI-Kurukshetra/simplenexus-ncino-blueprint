"use client";

import { useEffect, useState } from "react";

type Patient = {
  id: string;
  email: string;
  fullName: string;
  onboardingStatus: "not_started" | "in_progress" | "submitted";
  readyForScheduling: boolean;
  submittedAt: string | null;
  appointmentRequestCount: number;
  createdAt: string;
};

export function PatientManagementTable() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<"ready" | "not_ready" | "all">("all");
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  async function load(nextFilter = filter, showLoading = true) {
    if (showLoading) setState("loading");

    const response = await fetch(`/api/admin/patients?status=${nextFilter}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = await response.json();
    setPatients(payload?.data?.patients ?? []);
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/admin/patients?status=all", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setPatients(payload?.data?.patients ?? []);
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

  function onFilterChange(value: "ready" | "not_ready" | "all") {
    setFilter(value);
    void load(value, false);
  }

  const readyCount = patients.filter((item) => item.readyForScheduling).length;
  const pendingCount = patients.length - readyCount;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Patient Operations</h2>
          <p className="text-xs text-slate-500">
            Track onboarding readiness and booking load.
          </p>
        </div>
        <select
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as "ready" | "not_ready" | "all")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All Patients</option>
          <option value="ready">Ready for Scheduling</option>
          <option value="not_ready">Needs Onboarding</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Visible Patients" value={String(patients.length)} />
        <Summary label="Ready for Booking" value={String(readyCount)} />
        <Summary label="Needs Onboarding" value={String(pendingCount)} />
      </div>

      {state === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">Unable to load patient records.</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Email</th>
              <th className="px-2 py-2 font-medium">Onboarding</th>
              <th className="px-2 py-2 font-medium">Ready</th>
              <th className="px-2 py-2 font-medium">Requests</th>
              <th className="px-2 py-2 font-medium">Submitted</th>
              <th className="px-2 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium text-slate-900">{patient.fullName}</td>
                <td className="px-2 py-2 text-slate-600">{patient.email}</td>
                <td className="px-2 py-2">
                  <OnboardingStatus status={patient.onboardingStatus} />
                </td>
                <td className="px-2 py-2">
                  {patient.readyForScheduling ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                      Ready
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      Blocked
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-slate-700">{patient.appointmentRequestCount}</td>
                <td className="px-2 py-2 text-slate-600">
                  {patient.submittedAt ? new Date(patient.submittedAt).toLocaleString() : "-"}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {new Date(patient.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {patients.length === 0 && state === "idle" ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                  No patients found for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function OnboardingStatus({
  status,
}: {
  status: "not_started" | "in_progress" | "submitted";
}) {
  if (status === "submitted") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
        Submitted
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800">
        In Progress
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
      Not Started
    </span>
  );
}
