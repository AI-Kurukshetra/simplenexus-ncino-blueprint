import { NextResponse } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import {
  appendAppointmentEvent,
  findAppointmentRequestById,
  listAllAppointmentRequests,
  reminderEventsForStartsAt,
  updateAppointmentRequest,
} from "@/lib/appointments/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import { notifyAppointmentParticipants } from "@/lib/notifications/store";
import { hoursUntil, getSchedulingPolicy } from "@/lib/scheduling/policies";
import { reopenProviderSlot, reserveProviderSlot } from "@/lib/scheduling/store";
import { normalizedDateTimeSchema } from "@/lib/scheduling/schemas";

const manageAppointmentSchema = z.discriminatedUnion("action", [
  z.object({
    appointmentId: z.string().min(1),
    action: z.literal("cancel"),
  }),
  z.object({
    appointmentId: z.string().min(1),
    action: z.literal("reschedule"),
    nextStartsAt: normalizedDateTimeSchema,
    nextSlotId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  if (session.role === "provider" && getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = manageAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid appointment action payload"), {
      status: 400,
    });
  }

  const found = await findAppointmentRequestById(parsed.data.appointmentId);
  if (found.error || !found.appointment || !found.patientUser) {
    return NextResponse.json(failure("NOT_FOUND", "Appointment request not found"), {
      status: 404,
    });
  }

  const appointment = found.appointment;

  if (session.role === "patient" && appointment.patientUserId !== session.user.id) {
    return NextResponse.json(failure("FORBIDDEN", "Cannot manage another patient's appointment"), {
      status: 403,
    });
  }

  if (session.role === "provider" && appointment.providerId !== session.user.id) {
    return NextResponse.json(failure("FORBIDDEN", "Cannot manage another provider's appointment"), {
      status: 403,
    });
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json(failure("INVALID_STATE", "Appointment is already cancelled"), {
      status: 409,
    });
  }

  if (appointment.status === "rejected" && parsed.data.action === "reschedule") {
    return NextResponse.json(
      failure("INVALID_STATE", "Rejected requests cannot be rescheduled"),
      { status: 409 },
    );
  }

  const policyResult = await getSchedulingPolicy({
    organizationId: appointment.organizationId,
  });
  if (policyResult.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load scheduling policy"), {
      status: 500,
    });
  }

  const policy = policyResult.policy;
  const isAdminActor = session.role === "admin" || session.role === "super_admin";
  const hoursBeforeStart = hoursUntil(appointment.startsAt);

  if (!isAdminActor) {
    if (hoursBeforeStart < 0) {
      return NextResponse.json(
        failure("POLICY_WINDOW", "Past appointments cannot be modified"),
        { status: 409 },
      );
    }

    if (
      parsed.data.action === "cancel" &&
      hoursBeforeStart < policy.cancellationMinHours
    ) {
      return NextResponse.json(
        failure(
          "POLICY_WINDOW",
          `Cancellation requires at least ${policy.cancellationMinHours} hours notice`,
        ),
        { status: 409 },
      );
    }

    if (
      parsed.data.action === "reschedule" &&
      hoursBeforeStart < policy.rescheduleMinHours
    ) {
      return NextResponse.json(
        failure(
          "POLICY_WINDOW",
          `Reschedule requires at least ${policy.rescheduleMinHours} hours notice`,
        ),
        { status: 409 },
      );
    }
  }

  if (parsed.data.action === "cancel") {
    let slotWarning: string | null = null;
    if (appointment.providerSlotId) {
      const reopened = await reopenProviderSlot({
        providerUserId: appointment.providerId,
        slotId: appointment.providerSlotId,
      });
      if (reopened.error) {
        slotWarning = "Slot reopen failed. Provider should verify availability manually.";
      }
    }

    const cancelledAt = new Date().toISOString();
    const updated = await updateAppointmentRequest({
      appointmentId: appointment.id,
      mutate: (current) =>
        appendAppointmentEvent(
          {
            ...current,
            status: "cancelled",
            cancelledAt,
            cancelledBy: session.user.id,
          },
          {
            type: "cancelled",
            at: cancelledAt,
            actorUserId: session.user.id,
            note: `Cancelled by ${session.role}`,
          },
        ),
    });

    if (updated.error || !updated.appointment) {
      return NextResponse.json(failure("INTERNAL_ERROR", "Unable to cancel appointment"), {
        status: 500,
      });
    }

    await notifyAppointmentParticipants({
      patientUserId: appointment.patientUserId,
      providerUserId: appointment.providerId,
      appointmentId: appointment.id,
      type: "appointment_cancelled",
      patient: {
        title: "Appointment Cancelled",
        message: `Your appointment scheduled for ${new Date(
          appointment.startsAt,
        ).toLocaleString()} has been cancelled.`,
        dedupeKey: `cancelled:patient:${appointment.id}`,
      },
      provider: {
        title: "Appointment Cancelled",
        message: `Appointment for ${appointment.patientEmail} on ${new Date(
          appointment.startsAt,
        ).toLocaleString()} was cancelled.`,
        dedupeKey: `cancelled:provider:${appointment.id}`,
      },
    });

    await recordAuditLogBestEffort({
      actorUserId: session.user.id,
      organizationId: appointment.organizationId,
      action: "appointment.cancelled",
      entityType: "appointment_request",
      entityId: appointment.id,
      details: {
        actorRole: session.role,
        patientUserId: appointment.patientUserId,
        providerUserId: appointment.providerId,
        startsAt: appointment.startsAt,
        warning: slotWarning,
      },
    });

    return NextResponse.json(
      success({
        appointment: updated.appointment,
        updated: true,
        warning: slotWarning,
      }),
    );
  }

  const nextStartsAt = parsed.data.nextStartsAt;
  const nextSlotId = parsed.data.nextSlotId;

  const allAppointments = await listAllAppointmentRequests();
  if (allAppointments.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to validate slot collisions"), {
      status: 500,
    });
  }

  const conflict = allAppointments.requests.some((item) => {
    if (item.id === appointment.id) return false;
    if (item.providerId !== appointment.providerId) return false;
    if (item.startsAt !== nextStartsAt) return false;
    return item.status === "pending_provider_approval" || item.status === "approved";
  });

  if (conflict) {
    return NextResponse.json(
      failure("SLOT_UNAVAILABLE", "Selected slot is already reserved"),
      { status: 409 },
    );
  }

  const reserved = await reserveProviderSlot({
    providerUserId: appointment.providerId,
    startsAt: nextStartsAt,
    slotId: nextSlotId,
  });
  if (reserved.error || reserved.unavailable) {
    return NextResponse.json(
      failure("SLOT_UNAVAILABLE", "Selected slot is no longer available"),
      { status: 409 },
    );
  }

  let reopenWarning: string | null = null;
  if (appointment.providerSlotId) {
    const reopened = await reopenProviderSlot({
      providerUserId: appointment.providerId,
      slotId: appointment.providerSlotId,
    });
    if (reopened.error) {
      reopenWarning = "Previous slot could not be reopened automatically";
    }
  }

  const rescheduledAt = new Date().toISOString();
  const updated = await updateAppointmentRequest({
    appointmentId: appointment.id,
    mutate: (current) => {
      const nextStatus = session.role === "patient" ? "pending_provider_approval" : "approved";
      const base = appendAppointmentEvent(
        {
          ...current,
          startsAt: nextStartsAt,
          providerSlotId: nextSlotId,
          status: nextStatus,
          rescheduledAt,
          rescheduledBy: session.user.id,
          decidedAt: nextStatus === "approved" ? rescheduledAt : undefined,
          decidedBy: nextStatus === "approved" ? session.user.id : undefined,
        },
        {
          type: "rescheduled",
          at: rescheduledAt,
          actorUserId: session.user.id,
          note: `Moved from ${current.startsAt} to ${nextStartsAt}`,
        },
      );

      const reminderEvents = reminderEventsForStartsAt(nextStartsAt);
      if (reminderEvents.length === 0) return base;

      return {
        ...base,
        events: [...base.events, ...reminderEvents],
      };
    },
  });

  if (updated.error || !updated.appointment) {
    await reopenProviderSlot({
      providerUserId: appointment.providerId,
      slotId: nextSlotId,
    });
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to reschedule appointment"), {
      status: 500,
    });
  }

  await notifyAppointmentParticipants({
    patientUserId: appointment.patientUserId,
    providerUserId: appointment.providerId,
    appointmentId: appointment.id,
    type: "appointment_rescheduled",
    patient: {
      title: "Appointment Rescheduled",
      message: `Appointment moved to ${new Date(nextStartsAt).toLocaleString()}${
        session.role === "patient" ? " and is pending approval." : "."
      }`,
      dedupeKey: `rescheduled:patient:${appointment.id}:${nextStartsAt}`,
    },
    provider: {
      title: "Appointment Rescheduled",
      message: `Appointment for ${appointment.patientEmail} moved to ${new Date(
        nextStartsAt,
      ).toLocaleString()}.`,
      dedupeKey: `rescheduled:provider:${appointment.id}:${nextStartsAt}`,
    },
  });

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: appointment.organizationId,
    action: "appointment.rescheduled",
    entityType: "appointment_request",
    entityId: appointment.id,
    details: {
      actorRole: session.role,
      previousStartsAt: appointment.startsAt,
      nextStartsAt,
      previousSlotId: appointment.providerSlotId,
      nextSlotId,
      statusAfter: updated.appointment.status,
      warning: reopenWarning,
    },
  });

  return NextResponse.json(
    success({
      appointment: updated.appointment,
      updated: true,
      warning: reopenWarning,
    }),
  );
}
