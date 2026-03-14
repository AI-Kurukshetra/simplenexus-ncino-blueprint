import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AppointmentRow = {
  id: string;
  organization_id: string;
  patient_user_id: string;
  provider_user_id: string;
  starts_at: string;
  reason: string;
  appointment_type: "consult" | "follow-up" | "intake";
  status: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
};

type VisitRow = {
  appointment_id: string;
  organization_id: string;
  provider_user_id: string;
  visit_status: "not_started" | "in_progress" | "completed";
  started_at: string | null;
  completed_at: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  updated_at: string;
};

type AppointmentOwnershipRow = {
  id: string;
  patient_user_id: string;
};

export type ProviderVisitRecord = {
  appointmentId: string;
  organizationId: string;
  providerUserId: string;
  patientUserId: string;
  patientEmail: string;
  startsAt: string;
  reason: string;
  appointmentType: "consult" | "follow-up" | "intake";
  appointmentStatus: "pending_provider_approval" | "approved" | "rejected" | "cancelled";
  visitStatus: "not_started" | "in_progress" | "completed";
  startedAt?: string;
  completedAt?: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  updatedAt?: string;
};

export type AppointmentVisitNotes = {
  appointmentId: string;
  visitStatus: "not_started" | "in_progress" | "completed";
  startedAt?: string;
  completedAt?: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  updatedAt: string;
};

async function authUserEmailMap() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    return { error, map: new Map<string, string>() };
  }

  return {
    error: null,
    map: new Map<string, string>(data.users.map((user) => [user.id, user.email ?? ""])),
  };
}

function withVisitFallback(appointment: AppointmentRow, visit?: VisitRow): ProviderVisitRecord {
  return {
    appointmentId: appointment.id,
    organizationId: appointment.organization_id,
    providerUserId: appointment.provider_user_id,
    patientUserId: appointment.patient_user_id,
    patientEmail: "",
    startsAt: appointment.starts_at,
    reason: appointment.reason,
    appointmentType: appointment.appointment_type,
    appointmentStatus: appointment.status,
    visitStatus: visit?.visit_status ?? "not_started",
    startedAt: visit?.started_at ?? undefined,
    completedAt: visit?.completed_at ?? undefined,
    subjective: visit?.subjective ?? "",
    objective: visit?.objective ?? "",
    assessment: visit?.assessment ?? "",
    plan: visit?.plan ?? "",
    updatedAt: visit?.updated_at ?? undefined,
  };
}

export async function listApprovedVisitsForProvider(providerUser: User) {
  const admin = createSupabaseAdminClient();
  const { data: appointmentRows, error: appointmentError } = await admin
    .from("appointment_requests")
    .select(
      "id, organization_id, patient_user_id, provider_user_id, starts_at, reason, appointment_type, status",
    )
    .eq("provider_user_id", providerUser.id)
    .eq("status", "approved")
    .order("starts_at", { ascending: true });

  if (appointmentError) {
    return { error: appointmentError, visits: [] as ProviderVisitRecord[] };
  }

  const appointments = (appointmentRows ?? []) as AppointmentRow[];
  const appointmentIds = appointments.map((row) => row.id);
  if (appointmentIds.length === 0) {
    return { error: null, visits: [] as ProviderVisitRecord[] };
  }

  const { data: visitRows, error: visitError } = await admin
    .from("appointment_visit_notes")
    .select(
      "appointment_id, organization_id, provider_user_id, visit_status, started_at, completed_at, subjective, objective, assessment, plan, updated_at",
    )
    .in("appointment_id", appointmentIds);

  if (visitError) {
    return { error: visitError, visits: [] as ProviderVisitRecord[] };
  }

  const visitByAppointment = new Map<string, VisitRow>(
    ((visitRows ?? []) as VisitRow[]).map((row) => [row.appointment_id, row]),
  );

  const emailResult = await authUserEmailMap();
  if (emailResult.error) {
    return { error: emailResult.error, visits: [] as ProviderVisitRecord[] };
  }

  const visits = appointments.map((appointment) => {
    const visit = visitByAppointment.get(appointment.id);
    const mapped = withVisitFallback(appointment, visit);
    mapped.patientEmail = emailResult.map.get(appointment.patient_user_id) ?? "patient@example.com";
    return mapped;
  });

  return { error: null, visits };
}

export async function upsertProviderVisitRecord(params: {
  appointmentId: string;
  organizationId: string;
  providerUserId: string;
  action: "start" | "complete" | "save_notes";
  notes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
}) {
  const admin = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("appointment_visit_notes")
    .select(
      "appointment_id, organization_id, provider_user_id, visit_status, started_at, completed_at, subjective, objective, assessment, plan, updated_at",
    )
    .eq("appointment_id", params.appointmentId)
    .maybeSingle();

  if (existingError) {
    return { error: existingError, visit: null as VisitRow | null };
  }

  const now = new Date().toISOString();
  const current = (existing as VisitRow | null) ?? null;

  let nextStatus: VisitRow["visit_status"] = current?.visit_status ?? "not_started";
  let nextStartedAt = current?.started_at ?? null;
  let nextCompletedAt = current?.completed_at ?? null;

  if (params.action === "start") {
    nextStatus = "in_progress";
    nextStartedAt = nextStartedAt ?? now;
    nextCompletedAt = null;
  } else if (params.action === "complete") {
    nextStatus = "completed";
    nextStartedAt = nextStartedAt ?? now;
    nextCompletedAt = now;
  }

  const nextSubjective =
    typeof params.notes?.subjective === "string"
      ? params.notes.subjective
      : (current?.subjective ?? "");
  const nextObjective =
    typeof params.notes?.objective === "string"
      ? params.notes.objective
      : (current?.objective ?? "");
  const nextAssessment =
    typeof params.notes?.assessment === "string"
      ? params.notes.assessment
      : (current?.assessment ?? "");
  const nextPlan =
    typeof params.notes?.plan === "string" ? params.notes.plan : (current?.plan ?? "");

  const { data: updated, error: upsertError } = await admin
    .from("appointment_visit_notes")
    .upsert(
      {
        appointment_id: params.appointmentId,
        organization_id: params.organizationId,
        provider_user_id: params.providerUserId,
        visit_status: nextStatus,
        started_at: nextStartedAt,
        completed_at: nextCompletedAt,
        subjective: nextSubjective,
        objective: nextObjective,
        assessment: nextAssessment,
        plan: nextPlan,
      },
      { onConflict: "appointment_id", ignoreDuplicates: false },
    )
    .select(
      "appointment_id, organization_id, provider_user_id, visit_status, started_at, completed_at, subjective, objective, assessment, plan, updated_at",
    )
    .single();

  if (upsertError || !updated) {
    return { error: upsertError ?? new Error("Unable to save visit details"), visit: null as VisitRow | null };
  }

  return { error: null, visit: updated as VisitRow };
}

export async function getVisitNotesForPatient(params: {
  appointmentId: string;
  patientUserId: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await admin
    .from("appointment_requests")
    .select("id, patient_user_id")
    .eq("id", params.appointmentId)
    .maybeSingle();

  if (appointmentError) {
    return {
      error: appointmentError,
      notes: null as AppointmentVisitNotes | null,
      forbidden: false,
      notFound: false,
    };
  }
  if (!appointment) {
    return {
      error: new Error("Appointment not found"),
      notes: null as AppointmentVisitNotes | null,
      forbidden: false,
      notFound: true,
    };
  }

  const owner = appointment as AppointmentOwnershipRow;
  if (owner.patient_user_id !== params.patientUserId) {
    return {
      error: new Error("Forbidden"),
      notes: null as AppointmentVisitNotes | null,
      forbidden: true,
      notFound: false,
    };
  }

  const { data: row, error } = await admin
    .from("appointment_visit_notes")
    .select(
      "appointment_id, visit_status, started_at, completed_at, subjective, objective, assessment, plan, updated_at",
    )
    .eq("appointment_id", params.appointmentId)
    .maybeSingle();

  if (error) {
    return {
      error,
      notes: null as AppointmentVisitNotes | null,
      forbidden: false,
      notFound: false,
    };
  }
  if (!row) {
    return { error: null, notes: null as AppointmentVisitNotes | null, forbidden: false, notFound: false };
  }

  const visit = row as Pick<
    VisitRow,
    | "appointment_id"
    | "visit_status"
    | "started_at"
    | "completed_at"
    | "subjective"
    | "objective"
    | "assessment"
    | "plan"
    | "updated_at"
  >;

  return {
    error: null,
    notes: {
      appointmentId: visit.appointment_id,
      visitStatus: visit.visit_status,
      startedAt: visit.started_at ?? undefined,
      completedAt: visit.completed_at ?? undefined,
      subjective: visit.subjective,
      objective: visit.objective,
      assessment: visit.assessment,
      plan: visit.plan,
      updatedAt: visit.updated_at,
    } satisfies AppointmentVisitNotes,
    forbidden: false,
    notFound: false,
  };
}
