import { randomUUID } from "node:crypto";

import type { User } from "@supabase/supabase-js";

import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppointmentLifecycleEvent = {
  id: string;
  type:
    | "requested"
    | "approved"
    | "rejected"
    | "rescheduled"
    | "cancelled"
    | "reminder_24h_scheduled"
    | "reminder_1h_scheduled"
    | "reminder_24h_sent"
    | "reminder_1h_sent";
  at: string;
  dispatchedAt?: string;
  actorUserId?: string;
  note?: string;
};

export type AppointmentRequest = {
  id: string;
  organizationId: string;
  patientUserId: string;
  patientEmail: string;
  providerId: string;
  providerSlotId?: string;
  startsAt: string;
  reason: string;
  appointmentType: "consult" | "follow-up" | "intake";
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  rescheduledAt?: string;
  rescheduledBy?: string;
  events: AppointmentLifecycleEvent[];
};

type AppointmentRow = {
  id: string;
  organization_id: string;
  patient_user_id: string;
  provider_user_id: string;
  provider_slot_id: string | null;
  starts_at: string;
  reason: string;
  appointment_type: "consult" | "follow-up" | "intake";
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  rescheduled_at: string | null;
  rescheduled_by: string | null;
};

type EventRow = {
  id: string;
  appointment_id: string;
  event_type: AppointmentLifecycleEvent["type"];
  occurred_at: string;
  dispatched_at: string | null;
  actor_user_id: string | null;
  note: string | null;
};

function eventFromRow(row: EventRow): AppointmentLifecycleEvent {
  return {
    id: row.id,
    type: row.event_type,
    at: row.occurred_at,
    dispatchedAt: row.dispatched_at ?? undefined,
    actorUserId: row.actor_user_id ?? undefined,
    note: row.note ?? undefined,
  };
}

function eventsToRows(appointmentId: string, events: AppointmentLifecycleEvent[]) {
  return events.map((event) => ({
    id: event.id,
    appointment_id: appointmentId,
    event_type: event.type,
    occurred_at: event.at,
    dispatched_at: event.dispatchedAt ?? null,
    actor_user_id: event.actorUserId ?? null,
    note: event.note ?? null,
  }));
}

function buildLifecycleEvent(input: {
  type: AppointmentLifecycleEvent["type"];
  at?: string;
  actorUserId?: string;
  note?: string;
}): AppointmentLifecycleEvent {
  return {
    id: randomUUID(),
    type: input.type,
    at: input.at ?? new Date().toISOString(),
    actorUserId: input.actorUserId,
    note: input.note,
  };
}

function buildReminderEvents(startsAt: string): AppointmentLifecycleEvent[] {
  const startsAtTs = new Date(startsAt).valueOf();
  if (Number.isNaN(startsAtTs)) return [];

  const now = Date.now();
  const reminder24At = new Date(startsAtTs - 24 * 60 * 60 * 1000).toISOString();
  const reminder1At = new Date(startsAtTs - 60 * 60 * 1000).toISOString();

  const events: AppointmentLifecycleEvent[] = [];
  if (new Date(reminder24At).valueOf() > now) {
    events.push(
      buildLifecycleEvent({
        type: "reminder_24h_scheduled",
        at: reminder24At,
        note: "Reminder planned 24 hours before visit",
      }),
    );
  }
  if (new Date(reminder1At).valueOf() > now) {
    events.push(
      buildLifecycleEvent({
        type: "reminder_1h_scheduled",
        at: reminder1At,
        note: "Reminder planned 1 hour before visit",
      }),
    );
  }
  return events;
}

async function authUserMap() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return { error, map: new Map<string, User>() };

  return { error: null, map: new Map<string, User>(data.users.map((user) => [user.id, user])) };
}

function appointmentFromRow(params: {
  row: AppointmentRow;
  events: AppointmentLifecycleEvent[];
  patientEmail: string;
}): AppointmentRequest {
  return {
    id: params.row.id,
    organizationId: params.row.organization_id,
    patientUserId: params.row.patient_user_id,
    patientEmail: params.patientEmail,
    providerId: params.row.provider_user_id,
    providerSlotId: params.row.provider_slot_id ?? undefined,
    startsAt: params.row.starts_at,
    reason: params.row.reason,
    appointmentType: params.row.appointment_type,
    status: params.row.status,
    requestedAt: params.row.requested_at,
    decidedAt: params.row.decided_at ?? undefined,
    decidedBy: params.row.decided_by ?? undefined,
    cancelledAt: params.row.cancelled_at ?? undefined,
    cancelledBy: params.row.cancelled_by ?? undefined,
    rescheduledAt: params.row.rescheduled_at ?? undefined,
    rescheduledBy: params.row.rescheduled_by ?? undefined,
    events: params.events,
  };
}

async function eventMapByAppointment(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return { error: null, map: new Map<string, AppointmentLifecycleEvent[]>() };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("appointment_events")
    .select("id, appointment_id, event_type, occurred_at, dispatched_at, actor_user_id, note")
    .in("appointment_id", appointmentIds)
    .order("occurred_at", { ascending: true });

  if (error) return { error, map: new Map<string, AppointmentLifecycleEvent[]>() };

  const map = new Map<string, AppointmentLifecycleEvent[]>();
  for (const raw of (data ?? []) as EventRow[]) {
    const event = eventFromRow(raw);
    const current = map.get(raw.appointment_id) ?? [];
    current.push(event);
    map.set(raw.appointment_id, current);
  }

  return { error: null, map };
}

export function buildAppointmentRequest(input: {
  patientUserId: string;
  patientEmail: string;
  providerId: string;
  providerSlotId?: string;
  startsAt: string;
  reason: string;
  appointmentType: "consult" | "follow-up" | "intake";
}): AppointmentRequest {
  const requestedAt = new Date().toISOString();
  return {
    id: randomUUID(),
    organizationId: "",
    patientUserId: input.patientUserId,
    patientEmail: input.patientEmail,
    providerId: input.providerId,
    providerSlotId: input.providerSlotId,
    startsAt: input.startsAt,
    reason: input.reason,
    appointmentType: input.appointmentType,
    status: "pending_provider_approval",
    requestedAt,
    events: [
      buildLifecycleEvent({
        type: "requested",
        at: requestedAt,
        actorUserId: input.patientUserId,
      }),
      ...buildReminderEvents(input.startsAt),
    ],
  };
}

export async function appendAppointmentRequestForPatient(
  patientUser: User,
  request: AppointmentRequest,
) {
  const context = await ensureOrganizationContextForUser({
    user: patientUser,
    roleOverride: "patient",
  });
  if (context.error || !context.organizationId) {
    return { error: context.error ?? new Error("Unable to resolve organization context") };
  }

  const admin = createSupabaseAdminClient();
  const row = {
    id: request.id,
    organization_id: context.organizationId,
    patient_user_id: request.patientUserId,
    provider_user_id: request.providerId,
    provider_slot_id: request.providerSlotId ?? null,
    starts_at: request.startsAt,
    reason: request.reason,
    appointment_type: request.appointmentType,
    status: request.status,
    requested_at: request.requestedAt,
    decided_at: request.decidedAt ?? null,
    decided_by: request.decidedBy ?? null,
    cancelled_at: request.cancelledAt ?? null,
    cancelled_by: request.cancelledBy ?? null,
    rescheduled_at: request.rescheduledAt ?? null,
    rescheduled_by: request.rescheduledBy ?? null,
  };

  const { error: insertError } = await admin.from("appointment_requests").insert(row);
  if (insertError) return { error: insertError };

  const eventRows = eventsToRows(request.id, request.events);
  if (eventRows.length === 0) return { error: null };

  const { error: eventError } = await admin.from("appointment_events").insert(eventRows);
  return { error: eventError };
}

export async function listAllAppointmentRequests() {
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("appointment_requests")
    .select(
      "id, organization_id, patient_user_id, provider_user_id, provider_slot_id, starts_at, reason, appointment_type, status, requested_at, decided_at, decided_by, cancelled_at, cancelled_by, rescheduled_at, rescheduled_by",
    )
    .order("requested_at", { ascending: false });

  if (error) return { error, requests: [] as AppointmentRequest[] };

  const appointmentRows = (rows ?? []) as AppointmentRow[];
  const eventsResult = await eventMapByAppointment(appointmentRows.map((row) => row.id));
  if (eventsResult.error) return { error: eventsResult.error, requests: [] as AppointmentRequest[] };

  const usersResult = await authUserMap();
  if (usersResult.error) return { error: usersResult.error, requests: [] as AppointmentRequest[] };

  const requests = appointmentRows.map((row) =>
    appointmentFromRow({
      row,
      events: eventsResult.map.get(row.id) ?? [],
      patientEmail: usersResult.map.get(row.patient_user_id)?.email ?? "patient@example.com",
    }),
  );

  return { error: null, requests };
}

export async function findAppointmentRequestById(appointmentId: string) {
  const admin = createSupabaseAdminClient();

  const { data: row, error } = await admin
    .from("appointment_requests")
    .select(
      "id, organization_id, patient_user_id, provider_user_id, provider_slot_id, starts_at, reason, appointment_type, status, requested_at, decided_at, decided_by, cancelled_at, cancelled_by, rescheduled_at, rescheduled_by",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    return {
      error,
      appointment: null as AppointmentRequest | null,
      patientUser: null as User | null,
    };
  }

  if (!row) {
    return {
      error: null,
      appointment: null as AppointmentRequest | null,
      patientUser: null as User | null,
    };
  }

  const eventResult = await eventMapByAppointment([row.id as string]);
  if (eventResult.error) {
    return {
      error: eventResult.error,
      appointment: null as AppointmentRequest | null,
      patientUser: null as User | null,
    };
  }

  const { data: patientData, error: patientError } = await admin.auth.admin.getUserById(
    row.patient_user_id as string,
  );
  if (patientError || !patientData.user) {
    return {
      error: patientError ?? new Error("Patient not found"),
      appointment: null as AppointmentRequest | null,
      patientUser: null as User | null,
    };
  }

  const appointment = appointmentFromRow({
    row: row as AppointmentRow,
    events: eventResult.map.get(row.id as string) ?? [],
    patientEmail: patientData.user.email ?? "patient@example.com",
  });

  return {
    error: null,
    appointment,
    patientUser: patientData.user,
  };
}

export async function decideAppointmentRequest(params: {
  appointmentId: string;
  decision: "approved" | "rejected";
  decidedByUserId: string;
}) {
  const found = await findAppointmentRequestById(params.appointmentId);
  if (found.error || !found.patientUser || !found.appointment) return found;

  const decidedAt = new Date().toISOString();
  const updated = appendAppointmentEvent(
    {
      ...found.appointment,
      status: params.decision,
      decidedAt,
      decidedBy: params.decidedByUserId,
    },
    {
      type: params.decision === "approved" ? "approved" : "rejected",
      at: decidedAt,
      actorUserId: params.decidedByUserId,
    },
  );

  const updateResult = await updateAppointmentRequest({
    appointmentId: params.appointmentId,
    mutate: () => updated,
  });

  return {
    error: updateResult.error,
    appointment: found.appointment,
    patientUser: found.patientUser,
  };
}

export async function listRequestsForPatient(patientUser: User) {
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("appointment_requests")
    .select(
      "id, organization_id, patient_user_id, provider_user_id, provider_slot_id, starts_at, reason, appointment_type, status, requested_at, decided_at, decided_by, cancelled_at, cancelled_by, rescheduled_at, rescheduled_by",
    )
    .eq("patient_user_id", patientUser.id)
    .order("requested_at", { ascending: false });

  if (error) return [];

  const appointmentRows = (rows ?? []) as AppointmentRow[];
  const eventsResult = await eventMapByAppointment(appointmentRows.map((row) => row.id));
  if (eventsResult.error) return [];

  return appointmentRows.map((row) =>
    appointmentFromRow({
      row,
      events: eventsResult.map.get(row.id) ?? [],
      patientEmail: patientUser.email ?? "patient@example.com",
    }),
  );
}

export async function updateAppointmentRequest(params: {
  appointmentId: string;
  mutate: (appointment: AppointmentRequest) => AppointmentRequest;
}) {
  const found = await findAppointmentRequestById(params.appointmentId);
  if (found.error || !found.patientUser || !found.appointment) {
    return {
      error: found.error ?? new Error("Appointment not found"),
      appointment: null as AppointmentRequest | null,
      previousAppointment: null as AppointmentRequest | null,
      patientUser: found.patientUser,
    };
  }

  const mutated = params.mutate(found.appointment);
  const admin = createSupabaseAdminClient();

  const updateRow = {
    starts_at: mutated.startsAt,
    provider_slot_id: mutated.providerSlotId ?? null,
    reason: mutated.reason,
    appointment_type: mutated.appointmentType,
    status: mutated.status,
    decided_at: mutated.decidedAt ?? null,
    decided_by: mutated.decidedBy ?? null,
    cancelled_at: mutated.cancelledAt ?? null,
    cancelled_by: mutated.cancelledBy ?? null,
    rescheduled_at: mutated.rescheduledAt ?? null,
    rescheduled_by: mutated.rescheduledBy ?? null,
  };

  const { error: updateError } = await admin
    .from("appointment_requests")
    .update(updateRow)
    .eq("id", params.appointmentId);

  if (updateError) {
    return {
      error: updateError,
      appointment: null as AppointmentRequest | null,
      previousAppointment: found.appointment,
      patientUser: found.patientUser,
    };
  }

  const { error: deleteError } = await admin
    .from("appointment_events")
    .delete()
    .eq("appointment_id", params.appointmentId);
  if (deleteError) {
    return {
      error: deleteError,
      appointment: null as AppointmentRequest | null,
      previousAppointment: found.appointment,
      patientUser: found.patientUser,
    };
  }

  const eventRows = eventsToRows(params.appointmentId, mutated.events);
  if (eventRows.length > 0) {
    const { error: insertEventsError } = await admin.from("appointment_events").insert(eventRows);
    if (insertEventsError) {
      return {
        error: insertEventsError,
        appointment: null as AppointmentRequest | null,
        previousAppointment: found.appointment,
        patientUser: found.patientUser,
      };
    }
  }

  return {
    error: null,
    appointment: mutated,
    previousAppointment: found.appointment,
    patientUser: found.patientUser,
  };
}

export function appendAppointmentEvent(
  appointment: AppointmentRequest,
  event: Omit<AppointmentLifecycleEvent, "id">,
) {
  return {
    ...appointment,
    events: [
      ...appointment.events,
      buildLifecycleEvent({
        type: event.type,
        at: event.at,
        actorUserId: event.actorUserId,
        note: event.note,
      }),
    ],
  };
}

export function reminderEventsForStartsAt(startsAt: string) {
  return buildReminderEvents(startsAt);
}
