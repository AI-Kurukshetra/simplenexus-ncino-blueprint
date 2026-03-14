import { NextResponse } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import { decideAppointmentRequest, findAppointmentRequestById } from "@/lib/appointments/store";
import { notifyAppointmentParticipants } from "@/lib/notifications/store";
import { reopenProviderSlot } from "@/lib/scheduling/store";

const decisionSchema = z.object({
  appointmentId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role === "provider" && getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid decision payload"), {
      status: 400,
    });
  }

  const found = await findAppointmentRequestById(parsed.data.appointmentId);
  if (found.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to find appointment"), {
      status: 500,
    });
  }
  if (!found.appointment) {
    return NextResponse.json(failure("NOT_FOUND", "Appointment request not found"), {
      status: 404,
    });
  }

  if (
    found.appointment.status === "cancelled" ||
    found.appointment.status === "approved" ||
    found.appointment.status === "rejected"
  ) {
    return NextResponse.json(
      failure("INVALID_STATE", "Only pending requests can be decided"),
      { status: 409 },
    );
  }

  if (session.role === "provider" && found.appointment.providerId !== session.user.id) {
    return NextResponse.json(
      failure("FORBIDDEN", "Cannot decide requests assigned to another provider"),
      { status: 403 },
    );
  }

  const result = await decideAppointmentRequest({
    appointmentId: parsed.data.appointmentId,
    decision: parsed.data.decision,
    decidedByUserId: session.user.id,
  });

  if (result.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to update appointment"), {
      status: 500,
    });
  }

  let slotReopenWarning: string | null = null;
  if (parsed.data.decision === "rejected" && found.appointment.providerSlotId) {
    const reopened = await reopenProviderSlot({
      providerUserId: found.appointment.providerId,
      slotId: found.appointment.providerSlotId,
    });

    if (reopened.error) {
      slotReopenWarning = "Decision saved but provider slot was not reopened automatically";
    }
  }

  await notifyAppointmentParticipants({
    patientUserId: found.appointment.patientUserId,
    providerUserId: found.appointment.providerId,
    appointmentId: found.appointment.id,
    type: parsed.data.decision === "approved" ? "appointment_approved" : "appointment_rejected",
    patient: {
      title:
        parsed.data.decision === "approved"
          ? "Appointment Approved"
          : "Appointment Rejected",
      message:
        parsed.data.decision === "approved"
          ? `Your appointment on ${new Date(found.appointment.startsAt).toLocaleString()} is approved.`
          : `Your appointment on ${new Date(found.appointment.startsAt).toLocaleString()} was rejected.`,
      dedupeKey: `${parsed.data.decision}:patient:${found.appointment.id}`,
    },
    provider: {
      title:
        parsed.data.decision === "approved"
          ? "Appointment Confirmed"
          : "Appointment Request Rejected",
      message: `Decision recorded for ${found.appointment.patientEmail} (${new Date(
        found.appointment.startsAt,
      ).toLocaleString()}).`,
      dedupeKey: `${parsed.data.decision}:provider:${found.appointment.id}`,
    },
  });

  return NextResponse.json(
    success({
      appointmentId: parsed.data.appointmentId,
      decision: parsed.data.decision,
      updated: true,
      warning: slotReopenWarning,
    }),
  );
}
