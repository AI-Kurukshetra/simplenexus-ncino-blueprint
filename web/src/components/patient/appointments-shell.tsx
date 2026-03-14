"use client";

import Link from "next/link";
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
  email: string;
  specialty: string;
};

type ProviderSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
};

export function AppointmentsShell() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerSlots, setProviderSlots] = useState<ProviderSlot[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "created" | "onboarding_required" | "slot_unavailable"
  >("loading");

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/appointments?view=patient", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/providers", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([appointmentsPayload, providersPayload]) => {
        if (!active) return;
        const fetchedAppointments = (appointmentsPayload?.data?.appointments ?? []) as Appointment[];
        const fetchedProviders = (providersPayload?.data?.providers ?? []) as Provider[];
        setAppointments(fetchedAppointments);
        setProviders(fetchedProviders);
        if (fetchedProviders.length === 0) {
          setProviderSlots([]);
        }
        setSelectedProviderId((previous) =>
          previous || fetchedProviders[0]?.id || "",
        );
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

  useEffect(() => {
    let active = true;

    if (!selectedProviderId) {
      return;
    }

    fetch(`/api/providers/availability?providerId=${encodeURIComponent(selectedProviderId)}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setProviderSlots(payload?.data?.slots ?? []);
      })
      .catch(() => {
        if (!active) return;
        setProviderSlots([]);
      });

    return () => {
      active = false;
    };
  }, [selectedProviderId]);

  async function bookAppointment(formData: FormData) {
    const providerId = String(formData.get("providerId") ?? "");
    const slotId = String(formData.get("slotId") ?? "");
    const selectedSlot = providerSlots.find((slot) => slot.id === slotId);

    if (!selectedSlot || !providerId) {
      setStatus("error");
      return;
    }

    const payload = {
      providerId,
      slotId,
      startsAt: selectedSlot.startsAt,
      reason: String(formData.get("reason") ?? ""),
      appointmentType: String(formData.get("appointmentType") ?? "consult"),
    };

    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const failurePayload = await response.json().catch(() => null);
      if (failurePayload?.error?.code === "ONBOARDING_REQUIRED") {
        setStatus("onboarding_required");
        return;
      }
      if (failurePayload?.error?.code === "SLOT_UNAVAILABLE") {
        setStatus("slot_unavailable");
        await refreshProviderSlots(providerId);
        return;
      }
      setStatus("error");
      return;
    }

    const created = await response.json();
    setAppointments((prev) => [created?.data?.appointment, ...prev].filter(Boolean));
    await refreshProviderSlots(providerId);
    setStatus("created");
  }

  async function refreshProviderSlots(providerId: string) {
    const response = await fetch(
      `/api/providers/availability?providerId=${encodeURIComponent(providerId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const payload = await response.json();
    setProviderSlots(payload?.data?.slots ?? []);
  }

  const providerMap = providers.reduce<Record<string, Provider>>((acc, provider) => {
    acc[provider.id] = provider;
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Appointment Requests</h2>
        {status === "loading" ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {status === "error" ? (
          <p className="text-sm text-rose-600">
            Unable to load or create appointment request.
          </p>
        ) : null}
        {status === "created" ? (
          <p className="text-sm text-emerald-700">
            Request submitted. Waiting for provider approval.
          </p>
        ) : null}
        {status === "onboarding_required" ? (
          <p className="text-sm text-amber-700">
            Complete{" "}
            <Link href="/app/patient/onboarding" className="underline decoration-amber-400">
              onboarding
            </Link>{" "}
            before requesting appointments.
          </p>
        ) : null}
        {status === "slot_unavailable" ? (
          <p className="text-sm text-rose-600">
            Selected slot is no longer available. Choose another slot and retry.
          </p>
        ) : null}
        <ul className="space-y-2">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="rounded-md border border-slate-200 px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{appointment.reason}</p>
                <StatusBadge status={appointment.status} />
              </div>
              <p className="mt-1 text-slate-600">
                {new Date(appointment.startsAt).toLocaleString()} • {appointment.appointmentType} •{" "}
                {providerMap[appointment.providerId]?.fullName ?? "Provider"}
              </p>
              <Link
                href={`/app/patient/appointments/${appointment.id}`}
                className="mt-2 inline-flex text-xs text-sky-700 hover:text-sky-900"
              >
                Open details
              </Link>
            </li>
          ))}
          {appointments.length === 0 && status !== "loading" ? (
            <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              No requests yet.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Request Appointment</h2>
        <p className="text-xs text-slate-500">
          Requests must be approved by the selected provider.
        </p>
        <form action={bookAppointment} className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Provider</span>
            <select
              name="providerId"
              required
              value={selectedProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            >
              {providers.length === 0 ? <option value="">No approved providers</option> : null}
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.fullName} - {provider.specialty}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Available Slot</span>
            <select
              name="slotId"
              required
              disabled={providerSlots.length === 0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {providerSlots.length === 0 ? (
                <option value="">No available slots for this provider</option>
              ) : null}
              {providerSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {new Date(slot.startsAt).toLocaleString()} - {new Date(slot.endsAt).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </label>
          <Field label="Reason" name="reason" placeholder="Follow-up consultation" />
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Appointment Type</span>
            <select
              name="appointmentType"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            >
              <option value="consult">Consult</option>
              <option value="follow-up">Follow-up</option>
              <option value="intake">Intake</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={providers.length === 0 || providerSlots.length === 0}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit request
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        required
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: Appointment["status"] }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
        Rejected
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
        Cancelled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
      Pending Provider Approval
    </span>
  );
}
