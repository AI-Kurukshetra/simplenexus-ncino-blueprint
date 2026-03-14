"use client";

import { useEffect, useState } from "react";

type Appointment = {
  id: string;
  providerId: string;
  patientEmail: string;
  startsAt: string;
  reason: string;
  appointmentType: string;
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
};

type Provider = {
  id: string;
  fullName: string;
};

export function AppointmentReviewTable() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "cancelled" | "all"
  >("pending");
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  async function load(nextFilter = filter) {
    setState("loading");

    const [appointmentsResponse, providersResponse] = await Promise.all([
      fetch("/api/appointments?view=admin", { cache: "no-store" }),
      fetch("/api/admin/providers?status=all", { cache: "no-store" }),
    ]);

    if (!appointmentsResponse.ok || !providersResponse.ok) {
      setState("error");
      return;
    }

    const appointmentsPayload = await appointmentsResponse.json();
    const providersPayload = await providersResponse.json();

    const allAppointments = (appointmentsPayload?.data?.appointments ?? []) as Appointment[];
    const providersList = (providersPayload?.data?.providers ?? []) as Provider[];

    const providerMap = providersList.reduce<Record<string, string>>((acc, provider) => {
      acc[provider.id] = provider.fullName;
      return acc;
    }, {});

    setProviders(providerMap);
    setAppointments(
      nextFilter === "all"
        ? allAppointments
        : allAppointments.filter((item) => {
            if (nextFilter === "pending") return item.status === "pending_provider_approval";
            if (nextFilter === "approved") return item.status === "approved";
            if (nextFilter === "cancelled") return item.status === "cancelled";
            return item.status === "rejected";
          }),
    );
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/appointments?view=admin", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/admin/providers?status=all", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
    ])
      .then(([appointmentsPayload, providersPayload]) => {
        if (!active) return;

        const allAppointments = (appointmentsPayload?.data?.appointments ?? []) as Appointment[];
        const providersList = (providersPayload?.data?.providers ?? []) as Provider[];

        const providerMap = providersList.reduce<Record<string, string>>((acc, provider) => {
          acc[provider.id] = provider.fullName;
          return acc;
        }, {});

        setProviders(providerMap);
        setAppointments(
          allAppointments.filter((item) => item.status === "pending_provider_approval"),
        );
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

  async function decide(appointmentId: string, decision: "approved" | "rejected") {
    const response = await fetch("/api/appointments/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, decision }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    await load(filter);
  }

  function onFilterChange(
    value: "pending" | "approved" | "rejected" | "cancelled" | "all",
  ) {
    setFilter(value);
    void load(value);
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Appointment Approval Queue</h2>
        <select
          value={filter}
          onChange={(event) =>
            onFilterChange(
              event.target.value as
                | "pending"
                | "approved"
                | "rejected"
                | "cancelled"
                | "all",
            )
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </div>

      {state === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">Unable to load or update appointments.</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2 font-medium">Patient</th>
              <th className="px-2 py-2 font-medium">Provider</th>
              <th className="px-2 py-2 font-medium">Start Time</th>
              <th className="px-2 py-2 font-medium">Reason</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="border-b border-slate-100">
                <td className="px-2 py-2">{appointment.patientEmail}</td>
                <td className="px-2 py-2">{providers[appointment.providerId] ?? appointment.providerId}</td>
                <td className="px-2 py-2 text-slate-700">
                  {new Date(appointment.startsAt).toLocaleString()}
                </td>
                <td className="px-2 py-2">{appointment.reason}</td>
                <td className="px-2 py-2">{appointment.appointmentType}</td>
                <td className="px-2 py-2">
                  <Status status={appointment.status} />
                </td>
                <td className="px-2 py-2">
                  {appointment.status === "pending_provider_approval" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decide(appointment.id, "approved")}
                        className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(appointment.id, "rejected")}
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
            {appointments.length === 0 && state === "idle" ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                  No appointments in this queue.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Status({
  status,
}: {
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
}) {
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
  if (status === "cancelled") {
    return (
      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
        Cancelled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
      Pending
    </span>
  );
}
