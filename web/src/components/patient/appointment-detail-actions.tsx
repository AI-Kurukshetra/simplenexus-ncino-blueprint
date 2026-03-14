"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProviderSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
};

type AppointmentStatus =
  | "pending_provider_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export function AppointmentDetailActions({
  appointmentId,
  providerId,
  status,
}: {
  appointmentId: string;
  providerId: string;
  status: AppointmentStatus;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<ProviderSlot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`/api/providers/availability?providerId=${encodeURIComponent(providerId)}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setSlots(payload?.data?.slots ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
      });

    return () => {
      active = false;
    };
  }, [providerId]);

  const locked = status === "cancelled" || status === "rejected";

  async function cancelAppointment() {
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/appointments/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId,
        action: "cancel",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (payload?.error?.code === "POLICY_WINDOW") {
        setMessage(payload?.error?.message ?? "Cancellation window policy blocked this action.");
      } else {
        setMessage("Unable to cancel appointment.");
      }
      setLoading(false);
      return;
    }

    setMessage("Appointment cancelled.");
    setLoading(false);
    router.refresh();
  }

  async function reschedule(formData: FormData) {
    const nextSlotId = String(formData.get("nextSlotId") ?? "");
    const slot = slots.find((item) => item.id === nextSlotId);
    if (!slot) {
      setMessage("Choose an available slot.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/appointments/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId,
        action: "reschedule",
        nextSlotId,
        nextStartsAt: slot.startsAt,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload?.error?.code;
      if (code === "POLICY_WINDOW") {
        setMessage(payload?.error?.message ?? "Reschedule window policy blocked this action.");
      } else if (code === "SLOT_UNAVAILABLE") {
        setMessage("Selected slot is no longer available.");
      } else if (code === "INVALID_STATE") {
        setMessage("Appointment state does not allow rescheduling.");
      } else {
        setMessage("Unable to reschedule appointment.");
      }
      setLoading(false);
      return;
    }

    setMessage("Reschedule request submitted.");
    setLoading(false);
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Manage Appointment</h2>
      <p className="text-xs text-slate-500">
        Cancellation and reschedule actions are policy-controlled and time-bound.
      </p>

      {locked ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          This appointment is locked due to its current status.
        </p>
      ) : null}

      <form action={reschedule} className="space-y-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Select new slot</span>
          <select
            name="nextSlotId"
            required
            disabled={locked || slots.length === 0 || loading}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {slots.length === 0 ? <option value="">No available slots</option> : null}
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {new Date(slot.startsAt).toLocaleString()} -{" "}
                {new Date(slot.endsAt).toLocaleTimeString()}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={locked || slots.length === 0 || loading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Request Reschedule
        </button>
      </form>

      <button
        type="button"
        onClick={cancelAppointment}
        disabled={locked || loading}
        className="rounded-md bg-rose-700 px-3 py-2 text-sm text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cancel Appointment
      </button>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
