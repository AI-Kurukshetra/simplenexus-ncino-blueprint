"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  type:
    | "appointment_requested"
    | "appointment_approved"
    | "appointment_rejected"
    | "appointment_rescheduled"
    | "appointment_cancelled"
    | "appointment_reminder_24h"
    | "appointment_reminder_1h"
    | "system";
  channel: "in_app" | "email" | "sms";
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  relatedAppointmentId?: string;
};

type ReminderRunSummary = {
  patientsScanned: number;
  appointmentsTouched: number;
  remindersDispatched: number;
  patientNotificationsCreated: number;
  providerNotificationsCreated: number;
};

export function NotificationCenter({
  allowReminderRun = false,
  appointmentBasePath = "/app/patient/appointments",
}: {
  allowReminderRun?: boolean;
  appointmentBasePath?: string | null;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [state, setState] = useState<"loading" | "idle" | "error" | "running">("loading");
  const [summary, setSummary] = useState<ReminderRunSummary | null>(null);

  async function load(nextUnreadOnly = unreadOnly, showLoading = true) {
    if (showLoading) setState("loading");

    const response = await fetch(
      `/api/notifications?limit=100&unread=${nextUnreadOnly ? "1" : "0"}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = await response.json();
    setNotifications(payload?.data?.notifications ?? []);
    setState("idle");
  }

  useEffect(() => {
    let active = true;

    fetch("/api/notifications?limit=100&unread=0", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setNotifications(payload?.data?.notifications ?? []);
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

  async function markRead(notificationId: string) {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    setNotifications((previous) =>
      previous.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              readAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  async function runReminderDispatch() {
    setState("running");
    const response = await fetch("/api/notifications/reminders/run", {
      method: "POST",
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = await response.json();
    setSummary(payload?.data?.summary ?? null);
    await load(unreadOnly, false);
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Notification Inbox</h2>
          <p className="text-xs text-slate-500">
            In-app reminders and appointment events. Unread: {unreadCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => {
                const next = event.target.checked;
                setUnreadOnly(next);
                void load(next, false);
              }}
            />
            Show unread only
          </label>
          {allowReminderRun ? (
            <button
              type="button"
              onClick={runReminderDispatch}
              disabled={state === "running"}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "running" ? "Running..." : "Run Reminder Dispatch"}
            </button>
          ) : null}
        </div>
      </div>

      {summary ? (
        <div className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 sm:grid-cols-5">
          <Summary label="Patients" value={String(summary.patientsScanned)} />
          <Summary label="Touched Appts" value={String(summary.appointmentsTouched)} />
          <Summary label="Reminders" value={String(summary.remindersDispatched)} />
          <Summary label="Patient Notices" value={String(summary.patientNotificationsCreated)} />
          <Summary label="Provider Notices" value={String(summary.providerNotificationsCreated)} />
        </div>
      ) : null}

      {state === "loading" ? <p className="text-sm text-slate-500">Loading notifications...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-rose-600">Unable to load or update notifications.</p>
      ) : null}

      <ul className="space-y-2">
        {notifications.map((item) => (
          <li
            key={item.id}
            className={`rounded-md border px-3 py-3 text-sm ${
              item.readAt ? "border-slate-200 bg-slate-50" : "border-sky-200 bg-sky-50/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">{item.title}</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
                  {item.channel}
                </span>
                {!item.readAt ? (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Mark Read
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-slate-700">{item.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              {item.relatedAppointmentId && appointmentBasePath ? (
                <Link
                  href={`${appointmentBasePath}/${item.relatedAppointmentId}`}
                  className="text-sky-700 hover:text-sky-900"
                >
                  View appointment
                </Link>
              ) : null}
            </div>
          </li>
        ))}
        {notifications.length === 0 && state === "idle" ? (
          <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
            No notifications for this filter.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
