import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationItem = {
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
  dedupeKey?: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  organization_id: string;
  type: NotificationItem["type"];
  channel: NotificationItem["channel"];
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  related_appointment_id: string | null;
  dedupe_key: string | null;
};

type ReminderDispatchSummary = {
  patientsScanned: number;
  appointmentsTouched: number;
  remindersDispatched: number;
  patientNotificationsCreated: number;
  providerNotificationsCreated: number;
};

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    channel: row.channel,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
    relatedAppointmentId: row.related_appointment_id ?? undefined,
    dedupeKey: row.dedupe_key ?? undefined,
  };
}

async function appendNotifications(rows: Array<Omit<NotificationRow, "id">>) {
  if (rows.length === 0) return { error: null, inserted: 0 };

  const admin = createSupabaseAdminClient();
  const keys = rows
    .map((row) => row.dedupe_key)
    .filter((value): value is string => Boolean(value));

  let existing = new Set<string>();
  if (keys.length > 0) {
    const { data: existingRows } = await admin
      .from("notifications")
      .select("user_id, dedupe_key")
      .in("dedupe_key", keys);

    existing = new Set(
      (existingRows ?? [])
        .map((row) => `${row.user_id as string}:${row.dedupe_key as string}`)
        .filter(Boolean),
    );
  }

  const insertable = rows.filter((row) => {
    if (!row.dedupe_key) return true;
    return !existing.has(`${row.user_id}:${row.dedupe_key}`);
  });

  if (insertable.length === 0) return { error: null, inserted: 0 };
  const { error } = await admin.from("notifications").insert(insertable);
  return { error, inserted: insertable.length };
}

export async function listNotificationsForUser(
  user: User,
  options?: { unreadOnly?: boolean; limit?: number },
) {
  const unreadOnly = options?.unreadOnly ?? false;
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("notifications")
    .select("id, user_id, organization_id, type, channel, title, message, created_at, read_at, related_appointment_id, dedupe_key", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data: rows, error } = await query;
  if (error) {
    return { notifications: [] as NotificationItem[], totalCount: 0, unreadCount: 0 };
  }

  const { count: unreadCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  const { count: totalCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return {
    notifications: ((rows ?? []) as NotificationRow[]).map(mapNotification),
    totalCount: totalCount ?? 0,
    unreadCount: unreadCount ?? 0,
  };
}

export async function markNotificationRead(params: {
  user: User;
  notificationId: string;
}) {
  const admin = createSupabaseAdminClient();
  const readAt = new Date().toISOString();

  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", params.notificationId)
    .eq("user_id", params.user.id)
    .is("read_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { error, updated: false };
  if (!data) return { error: new Error("Notification not found"), updated: false };
  return { error: null, updated: true };
}

export async function dispatchAppointmentReminders() {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const summary: ReminderDispatchSummary = {
    patientsScanned: 0,
    appointmentsTouched: 0,
    remindersDispatched: 0,
    patientNotificationsCreated: 0,
    providerNotificationsCreated: 0,
  };

  const { data: dueEvents, error: dueError } = await admin
    .from("appointment_events")
    .select("id, appointment_id, event_type, occurred_at")
    .in("event_type", ["reminder_24h_scheduled", "reminder_1h_scheduled"])
    .is("dispatched_at", null)
    .lte("occurred_at", nowIso);

  if (dueError) return { error: dueError, summary };
  if (!dueEvents || dueEvents.length === 0) return { error: null, summary };

  const appointmentIds = [...new Set(dueEvents.map((item) => item.appointment_id as string))];
  const { data: appointments, error: appointmentError } = await admin
    .from("appointment_requests")
    .select("id, organization_id, patient_user_id, provider_user_id, starts_at, appointment_type, status")
    .in("id", appointmentIds);
  if (appointmentError) return { error: appointmentError, summary };

  const appointmentMap = new Map<string, (typeof appointments)[number]>();
  for (const appointment of appointments ?? []) {
    appointmentMap.set(appointment.id as string, appointment);
  }

  const activeEvents = dueEvents.filter((event) => {
    const appointment = appointmentMap.get(event.appointment_id as string);
    if (!appointment) return false;
    const status = appointment.status as string;
    return status === "pending_provider_approval" || status === "approved";
  });

  const updateIds = dueEvents.map((event) => event.id as string);
  const { error: dispatchMarkError } = await admin
    .from("appointment_events")
    .update({ dispatched_at: nowIso })
    .in("id", updateIds);
  if (dispatchMarkError) return { error: dispatchMarkError, summary };

  const sentEvents = activeEvents.map((event) => ({
    appointment_id: event.appointment_id,
    event_type:
      event.event_type === "reminder_24h_scheduled"
        ? "reminder_24h_sent"
        : "reminder_1h_sent",
    occurred_at: nowIso,
    note:
      event.event_type === "reminder_24h_scheduled"
        ? "24 hour reminder dispatched"
        : "1 hour reminder dispatched",
  }));

  if (sentEvents.length > 0) {
    const { error: sentInsertError } = await admin.from("appointment_events").insert(sentEvents);
    if (sentInsertError) return { error: sentInsertError, summary };
  }

  const notifications: Array<Omit<NotificationRow, "id">> = [];
  const touchedAppointments = new Set<string>();
  const touchedPatients = new Set<string>();

  for (const event of activeEvents) {
    const appointment = appointmentMap.get(event.appointment_id as string);
    if (!appointment) continue;

    const reminderType =
      event.event_type === "reminder_24h_scheduled"
        ? "appointment_reminder_24h"
        : "appointment_reminder_1h";
    const reminderLabel = event.event_type === "reminder_24h_scheduled" ? "24 hours" : "1 hour";
    const dedupeSeed = `${appointment.id}:${event.event_type}:${event.occurred_at}`;

    notifications.push({
      organization_id: appointment.organization_id as string,
      user_id: appointment.patient_user_id as string,
      type: reminderType,
      channel: "in_app",
      title: `Appointment Reminder (${reminderLabel})`,
      message: `Upcoming ${appointment.appointment_type as string} appointment on ${new Date(
        appointment.starts_at as string,
      ).toLocaleString()}.`,
      related_appointment_id: appointment.id as string,
      dedupe_key: `patient:${dedupeSeed}`,
      created_at: nowIso,
      read_at: null,
    });

    notifications.push({
      organization_id: appointment.organization_id as string,
      user_id: appointment.provider_user_id as string,
      type: reminderType,
      channel: "in_app",
      title: `Patient Reminder Due (${reminderLabel})`,
      message: `Reminder window reached for an appointment on ${new Date(
        appointment.starts_at as string,
      ).toLocaleString()}.`,
      related_appointment_id: appointment.id as string,
      dedupe_key: `provider:${dedupeSeed}`,
      created_at: nowIso,
      read_at: null,
    });

    touchedAppointments.add(appointment.id as string);
    touchedPatients.add(appointment.patient_user_id as string);
  }

  const appendResult = await appendNotifications(notifications);
  if (appendResult.error) return { error: appendResult.error, summary };

  summary.remindersDispatched = activeEvents.length;
  summary.appointmentsTouched = touchedAppointments.size;
  summary.patientsScanned = touchedPatients.size;
  summary.patientNotificationsCreated = notifications.filter((row) => row.dedupe_key?.startsWith("patient:")).length;
  summary.providerNotificationsCreated = notifications.filter((row) => row.dedupe_key?.startsWith("provider:")).length;

  return { error: null, summary };
}

export async function notifyAppointmentParticipants(params: {
  patientUserId: string;
  providerUserId: string;
  appointmentId: string;
  type:
    | "appointment_requested"
    | "appointment_approved"
    | "appointment_rejected"
    | "appointment_rescheduled"
    | "appointment_cancelled";
  patient: { title: string; message: string; dedupeKey: string };
  provider?: { title: string; message: string; dedupeKey: string };
}) {
  const admin = createSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await admin
    .from("appointment_requests")
    .select("id, organization_id")
    .eq("id", params.appointmentId)
    .maybeSingle();

  if (appointmentError || !appointment) {
    return { error: appointmentError ?? new Error("Appointment not found") };
  }

  const rows: Array<Omit<NotificationRow, "id">> = [
    {
      organization_id: appointment.organization_id as string,
      user_id: params.patientUserId,
      type: params.type,
      channel: "in_app",
      title: params.patient.title,
      message: params.patient.message,
      related_appointment_id: params.appointmentId,
      dedupe_key: params.patient.dedupeKey,
      created_at: new Date().toISOString(),
      read_at: null,
    },
  ];

  if (params.provider) {
    rows.push({
      organization_id: appointment.organization_id as string,
      user_id: params.providerUserId,
      type: params.type,
      channel: "in_app",
      title: params.provider.title,
      message: params.provider.message,
      related_appointment_id: params.appointmentId,
      dedupe_key: params.provider.dedupeKey,
      created_at: new Date().toISOString(),
      read_at: null,
    });
  }

  const result = await appendNotifications(rows);
  return { error: result.error };
}
