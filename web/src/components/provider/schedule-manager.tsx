"use client";

import { useEffect, useState } from "react";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
  createdAt: string;
};

type UiState = "loading" | "idle" | "error" | "saved";

export function ScheduleManager() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [state, setState] = useState<UiState>("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setState("loading");

    const response = await fetch("/api/provider/availability", { cache: "no-store" });
    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = await response.json();
    setSlots(payload?.data?.slots ?? []);
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/provider/availability", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setSlots(payload?.data?.slots ?? []);
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

  async function createSlot(formData: FormData) {
    const startsAtRaw = String(formData.get("startsAt") ?? "");
    const endsAtRaw = String(formData.get("endsAt") ?? "");
    const startsAt = new Date(startsAtRaw);
    const endsAt = new Date(endsAtRaw);

    if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) {
      setState("error");
      setMessage("Invalid slot time.");
      return;
    }

    const response = await fetch("/api/provider/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload?.error?.code === "SLOT_CONFLICT") {
        setState("error");
        setMessage("Slot conflicts with an existing block or availability.");
        return;
      }

      setState("error");
      setMessage("Unable to create slot.");
      return;
    }

    setMessage("Availability slot added.");
    setState("saved");
    await load(false);
  }

  async function deleteSlot(slotId: string) {
    const response = await fetch(`/api/provider/availability?slotId=${encodeURIComponent(slotId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setState("error");
      setMessage("Unable to remove this slot.");
      return;
    }

    setMessage("Slot removed.");
    await load(false);
  }

  const totalSlots = slots.length;
  const availableCount = slots.filter((slot) => slot.status === "available").length;
  const bookedCount = slots.filter((slot) => slot.status === "booked").length;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total Slots" value={String(totalSlots)} />
        <MetricCard label="Available" value={String(availableCount)} />
        <MetricCard label="Booked" value={String(bookedCount)} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add Availability Slot</h2>
        <p className="mt-1 text-xs text-slate-500">
          Set clinic availability for patient booking. Each slot should be 15 to 240 minutes.
        </p>
        <form action={createSlot} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Start</span>
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">End</span>
            <input
              type="datetime-local"
              name="endsAt"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add Slot
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Availability Queue</h2>
        {state === "loading" ? <p className="mt-3 text-sm text-slate-500">Loading...</p> : null}
        {state === "error" ? (
          <p className="mt-3 text-sm text-rose-600">{message ?? "Unable to load availability."}</p>
        ) : null}
        {state === "saved" && message ? (
          <p className="mt-3 text-sm text-emerald-700">{message}</p>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Start</th>
                <th className="px-2 py-2 font-medium">End</th>
                <th className="px-2 py-2 font-medium">Duration</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-slate-700">{new Date(slot.startsAt).toLocaleString()}</td>
                  <td className="px-2 py-2 text-slate-700">{new Date(slot.endsAt).toLocaleString()}</td>
                  <td className="px-2 py-2 text-slate-700">{durationLabel(slot.startsAt, slot.endsAt)}</td>
                  <td className="px-2 py-2">
                    <SlotStatus status={slot.status} />
                  </td>
                  <td className="px-2 py-2">
                    {slot.status === "booked" ? (
                      <span className="text-xs text-slate-400">Locked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteSlot(slot.id)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {slots.length === 0 && state === "idle" ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-slate-500">
                    No availability slots added yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function SlotStatus({ status }: { status: Slot["status"] }) {
  if (status === "booked") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
        Booked
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">Blocked</span>
    );
  }
  return (
    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800">Available</span>
  );
}

function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.round((new Date(endsAt).valueOf() - new Date(startsAt).valueOf()) / 60000);
  return `${minutes} min`;
}
