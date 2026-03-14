import { NextResponse } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { findAppointmentRequestById } from "@/lib/appointments/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import { notifyAppointmentParticipants } from "@/lib/notifications/store";
import { upsertProviderVisitRecord } from "@/lib/provider-visits/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const visitManageSchema = z.discriminatedUnion("action", [
  z.object({
    appointmentId: z.string().uuid(),
    action: z.literal("start"),
  }),
  z.object({
    appointmentId: z.string().uuid(),
    action: z.literal("complete"),
  }),
  z.object({
    appointmentId: z.string().uuid(),
    action: z.literal("save_notes"),
    subjective: z.string().max(8000).optional(),
    objective: z.string().max(8000).optional(),
    assessment: z.string().max(8000).optional(),
    plan: z.string().max(8000).optional(),
  }),
]);

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["provider"]);
  if (roleGuard) return roleGuard;

  if (getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = visitManageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid visit action payload"), {
      status: 400,
    });
  }

  const found = await findAppointmentRequestById(parsed.data.appointmentId);
  if (found.error || !found.appointment) {
    return NextResponse.json(failure("NOT_FOUND", "Appointment not found"), {
      status: 404,
    });
  }

  const appointment = found.appointment;
  if (appointment.providerId !== session.user.id) {
    return NextResponse.json(failure("FORBIDDEN", "Cannot manage another provider's visit"), {
      status: 403,
    });
  }

  if (appointment.status !== "approved") {
    return NextResponse.json(
      failure("INVALID_STATE", "Only approved appointments can be started or completed"),
      { status: 409 },
    );
  }

  const notes =
    parsed.data.action === "save_notes"
      ? {
          subjective: parsed.data.subjective,
          objective: parsed.data.objective,
          assessment: parsed.data.assessment,
          plan: parsed.data.plan,
        }
      : undefined;

  const updated = await upsertProviderVisitRecord({
    appointmentId: appointment.id,
    organizationId: appointment.organizationId,
    providerUserId: appointment.providerId,
    action: parsed.data.action,
    notes,
  });

  if (updated.error || !updated.visit) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to save visit updates"), {
      status: 500,
    });
  }

  const eventType =
    parsed.data.action === "start"
      ? "visit_started"
      : parsed.data.action === "complete"
        ? "visit_completed"
        : "visit_note_added";
  const eventNote =
    parsed.data.action === "start"
      ? "Provider started the appointment."
      : parsed.data.action === "complete"
        ? "Provider completed the appointment."
        : "Provider added or updated visit notes.";

  const admin = createSupabaseAdminClient();
  await admin.from("appointment_events").insert({
    appointment_id: appointment.id,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    actor_user_id: session.user.id,
    note: eventNote,
  });

  await notifyAppointmentParticipants({
    patientUserId: appointment.patientUserId,
    providerUserId: appointment.providerId,
    appointmentId: appointment.id,
    type: "system",
    patient: {
      title:
        parsed.data.action === "start"
          ? "Appointment Started"
          : parsed.data.action === "complete"
            ? "Appointment Completed"
            : "Appointment Notes Updated",
      message:
        parsed.data.action === "start"
          ? `Your provider started your appointment scheduled for ${new Date(appointment.startsAt).toLocaleString()}.`
          : parsed.data.action === "complete"
            ? `Your provider marked the appointment on ${new Date(appointment.startsAt).toLocaleString()} as completed.`
            : `Your provider added updates to your appointment notes for ${new Date(appointment.startsAt).toLocaleString()}.`,
      dedupeKey: `${parsed.data.action}:patient:${appointment.id}:${updated.visit.updated_at}`,
    },
  });

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: appointment.organizationId,
    action:
      parsed.data.action === "start"
        ? "appointment.visit_started"
        : parsed.data.action === "complete"
          ? "appointment.visit_completed"
          : "appointment.visit_notes_saved",
    entityType: "appointment_visit",
    entityId: appointment.id,
    details: {
      appointmentId: appointment.id,
      visitStatus: updated.visit.visit_status,
      startedAt: updated.visit.started_at,
      completedAt: updated.visit.completed_at,
    },
  });

  return NextResponse.json(
    success({
      visit: {
        appointmentId: updated.visit.appointment_id,
        visitStatus: updated.visit.visit_status,
        startedAt: updated.visit.started_at,
        completedAt: updated.visit.completed_at,
        subjective: updated.visit.subjective,
        objective: updated.visit.objective,
        assessment: updated.visit.assessment,
        plan: updated.visit.plan,
        updatedAt: updated.visit.updated_at,
      },
    }),
  );
}
