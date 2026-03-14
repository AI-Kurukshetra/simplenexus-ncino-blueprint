"use client";

import { useEffect, useState } from "react";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
  generatedFrom: "manual" | "weekly_template";
  weeklyDayOfWeek?: number;
  createdAt: string;
};

type WeeklyWindow = {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  startTime?: string;
  endTime?: string;
};

type WeeklySchedule = {
  timezone: string;
  slotDurationMinutes: 15 | 30 | 45 | 60;
  horizonDays: number;
  windows: WeeklyWindow[];
};

type UiState = "loading" | "idle" | "saving" | "error";

const DEFAULT_WINDOWS: WeeklyWindow[] = [
  { dayOfWeek: 0, label: "Sunday", enabled: false },
  { dayOfWeek: 1, label: "Monday", enabled: true, startTime: "10:00", endTime: "18:00" },
  { dayOfWeek: 2, label: "Tuesday", enabled: true, startTime: "10:00", endTime: "18:00" },
  { dayOfWeek: 3, label: "Wednesday", enabled: true, startTime: "10:00", endTime: "18:00" },
  { dayOfWeek: 4, label: "Thursday", enabled: true, startTime: "10:00", endTime: "18:00" },
  { dayOfWeek: 5, label: "Friday", enabled: true, startTime: "10:00", endTime: "18:00" },
  { dayOfWeek: 6, label: "Saturday", enabled: false },
];

function guessedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function ScheduleManager() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [weekly, setWeekly] = useState<WeeklySchedule>({
    timezone: guessedTimeZone(),
    slotDurationMinutes: 30,
    horizonDays: 56,
    windows: DEFAULT_WINDOWS,
  });
  const [state, setState] = useState<UiState>("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setState("loading");
    const response = await fetch("/api/provider/availability", { cache: "no-store" });
    if (!response.ok) {
      setState("error");
      setMessage("Unable to load weekly schedule.");
      return;
    }

    const payload = await response.json();
    const fetchedSlots = (payload?.data?.slots ?? []) as Slot[];
    const fetchedWeekly = payload?.data?.weeklySchedule as WeeklySchedule | undefined;
    setSlots(fetchedSlots);
    if (fetchedWeekly?.windows?.length === 7) {
      setWeekly({
        timezone: fetchedWeekly.timezone || guessedTimeZone(),
        slotDurationMinutes: fetchedWeekly.slotDurationMinutes || 30,
        horizonDays: fetchedWeekly.horizonDays || 56,
        windows: fetchedWeekly.windows,
      });
    }
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/provider/availability", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load");
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        const fetchedSlots = (payload?.data?.slots ?? []) as Slot[];
        const fetchedWeekly = payload?.data?.weeklySchedule as WeeklySchedule | undefined;
        setSlots(fetchedSlots);
        if (fetchedWeekly?.windows?.length === 7) {
          setWeekly({
            timezone: fetchedWeekly.timezone || guessedTimeZone(),
            slotDurationMinutes: fetchedWeekly.slotDurationMinutes || 30,
            horizonDays: fetchedWeekly.horizonDays || 56,
            windows: fetchedWeekly.windows,
          });
        }
        setState("idle");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
        setMessage("Unable to load weekly schedule.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveWeeklySchedule() {
    setState("saving");
    setMessage(null);

    const response = await fetch("/api/provider/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: weekly.timezone,
        slotDurationMinutes: String(weekly.slotDurationMinutes),
        horizonDays: weekly.horizonDays,
        windows: weekly.windows.map((window) => ({
          dayOfWeek: window.dayOfWeek,
          enabled: window.enabled,
          startTime: window.enabled ? (window.startTime ?? "09:00") : undefined,
          endTime: window.enabled ? (window.endTime ?? "17:00") : undefined,
        })),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to save weekly schedule.");
      return;
    }

    setSlots((payload?.data?.slots ?? []) as Slot[]);
    const generatedCount = Number(payload?.data?.generatedCount ?? 0);
    const skippedConflicts = Number(payload?.data?.skippedConflicts ?? 0);
    setState("idle");
    setMessage(
      `Weekly schedule saved. Generated ${generatedCount} slots${skippedConflicts > 0 ? `, skipped ${skippedConflicts} conflicts` : ""}.`,
    );
  }

  async function deleteSlot(slotId: string) {
    setState("saving");
    setMessage(null);

    const response = await fetch(`/api/provider/availability?slotId=${encodeURIComponent(slotId)}`, {
      method: "DELETE",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState("error");
      setMessage(payload?.error?.message ?? "Unable to remove slot.");
      return;
    }

    setSlots((previous) => previous.filter((slot) => slot.id !== slotId));
    setState("idle");
    setMessage("Slot removed.");
  }

  function updateWindow(dayOfWeek: number, patch: Partial<WeeklyWindow>) {
    setWeekly((previous) => ({
      ...previous,
      windows: previous.windows.map((window) =>
        window.dayOfWeek === dayOfWeek ? { ...window, ...patch } : window,
      ),
    }));
  }

  const enabledDays = weekly.windows.filter((window) => window.enabled).length;
  const availableCount = slots.filter((slot) => slot.status === "available").length;
  const bookedCount = slots.filter((slot) => slot.status === "booked").length;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Enabled Days" value={`${enabledDays}/7`} />
        <MetricCard label="Slot Duration" value={`${weekly.slotDurationMinutes} min`} />
        <MetricCard label="Upcoming Available" value={String(availableCount)} />
        <MetricCard label="Booked" value={String(bookedCount)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Weekly Clinic Schedule</h2>
            <p className="mt-1 text-xs text-slate-500">
              Set recurring availability by weekday. The system auto-generates slots and skips conflicts.
            </p>
          </div>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            Timezone: {weekly.timezone}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Slot Duration</span>
            <select
              value={String(weekly.slotDurationMinutes)}
              onChange={(event) =>
                setWeekly((previous) => ({
                  ...previous,
                  slotDurationMinutes: Number(event.target.value) as 15 | 30 | 45 | 60,
                }))
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Generation Horizon</span>
            <select
              value={String(weekly.horizonDays)}
              onChange={(event) =>
                setWeekly((previous) => ({
                  ...previous,
                  horizonDays: Number(event.target.value),
                }))
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-cyan-200 focus:ring-2"
            >
              <option value="28">4 weeks</option>
              <option value="56">8 weeks</option>
              <option value="84">12 weeks</option>
            </select>
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Day</th>
                <th className="px-2 py-2 font-medium">Enabled</th>
                <th className="px-2 py-2 font-medium">Start Time</th>
                <th className="px-2 py-2 font-medium">End Time</th>
                <th className="px-2 py-2 font-medium">Clinic Type</th>
              </tr>
            </thead>
            <tbody>
              {weekly.windows.map((window) => (
                <tr key={window.dayOfWeek} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{window.label}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateWindow(window.dayOfWeek, {
                          enabled: !window.enabled,
                          startTime: !window.enabled
                            ? (window.startTime ?? "09:00")
                            : window.startTime,
                          endTime: !window.enabled
                            ? (window.endTime ?? "17:00")
                            : window.endTime,
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs ${
                        window.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {window.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      value={window.startTime ?? "09:00"}
                      disabled={!window.enabled}
                      onChange={(event) =>
                        updateWindow(window.dayOfWeek, { startTime: event.target.value })
                      }
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      value={window.endTime ?? "17:00"}
                      disabled={!window.enabled}
                      onChange={(event) =>
                        updateWindow(window.dayOfWeek, { endTime: event.target.value })
                      }
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {window.enabled ? (
                      <span>
                        {window.startTime && window.endTime && window.startTime < "12:00"
                          ? "Morning or mixed clinic"
                          : "Afternoon or evening clinic"}
                      </span>
                    ) : (
                      <span className="text-slate-400">No clinic</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveWeeklySchedule()}
            disabled={state === "saving"}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply Weekly Schedule
          </button>
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={state === "saving"}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Generated Availability</h2>
        <p className="mt-1 text-xs text-slate-500">
          Patients automatically see these slots while booking appointments.
        </p>

        {state === "loading" ? <p className="mt-3 text-sm text-slate-500">Loading schedule...</p> : null}
        {state === "error" && message ? <p className="mt-3 text-sm text-rose-600">{message}</p> : null}
        {state !== "error" && message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Start</th>
                <th className="px-2 py-2 font-medium">End</th>
                <th className="px-2 py-2 font-medium">Duration</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-slate-700">{new Date(slot.startsAt).toLocaleString()}</td>
                  <td className="px-2 py-2 text-slate-700">{new Date(slot.endsAt).toLocaleString()}</td>
                  <td className="px-2 py-2 text-slate-700">{durationLabel(slot.startsAt, slot.endsAt)}</td>
                  <td className="px-2 py-2">
                    {slot.generatedFrom === "weekly_template" ? (
                      <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs text-cyan-800">
                        Weekly Template
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <SlotStatus status={slot.status} />
                  </td>
                  <td className="px-2 py-2">
                    {slot.status === "booked" ? (
                      <span className="text-xs text-slate-400">Locked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void deleteSlot(slot.id)}
                        disabled={state === "saving"}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {slots.length === 0 && state !== "loading" ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
                    No slots generated yet. Configure weekly schedule and apply.
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
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
