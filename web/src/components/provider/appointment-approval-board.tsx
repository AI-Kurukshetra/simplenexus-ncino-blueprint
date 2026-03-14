"use client";

import { useEffect, useState } from "react";

type Appointment = {
  id: string;
  patientEmail: string;
  startsAt: string;
  reason: string;
  appointmentType: string;
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
};

export function AppointmentApprovalBoard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");

  async function load(showLoading = true) {
    if (showLoading) setStatus("loading");

    const response = await fetch("/api/appointments?view=provider", {
      cache: "no-store",
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const payload = await response.json();
    setAppointments(payload?.data?.appointments ?? []);
    setStatus("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/appointments?view=provider", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setAppointments(payload?.data?.appointments ?? []);
        setStatus("idle");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function decide(appointmentId: string, decision: "approved" | "rejected") {
    const response = await fetch("/api/appointments/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, decision }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    await load(false);
  }

  const pending = appointments.filter((item) => item.status === "pending_provider_approval");

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Pending Appointment Approvals</h2>
      {status === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {status === "error" ? (
        <p className="text-sm text-rose-600">Unable to load or process approvals.</p>
      ) : null}

      {pending.length === 0 && status === "idle" ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
          No pending appointment requests.
        </p>
      ) : null}

      <ul className="space-y-3">
        {pending.map((item) => (
          <li key={item.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">{item.reason}</p>
            <p className="mt-1 text-xs text-slate-600">
              {item.patientEmail} • {new Date(item.startsAt).toLocaleString()} •{" "}
              {item.appointmentType}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => decide(item.id, "approved")}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(item.id, "rejected")}
                className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
