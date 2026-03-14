import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import {
  getProviderApprovalStatus,
  getRoleFromUser,
} from "@/lib/auth/roles";
import {
  appendAppointmentRequestForPatient,
  buildAppointmentRequest,
  listAllAppointmentRequests,
  listRequestsForPatient,
} from "@/lib/appointments/store";
import { getPatientOnboardingSnapshotForUser } from "@/lib/patients/store";
import { reserveProviderSlot } from "@/lib/scheduling/store";
import {
  appointmentCreateSchema,
  appointmentViewSchema,
} from "@/lib/scheduling/schemas";
import { notifyAppointmentParticipants } from "@/lib/notifications/store";

export async function GET(request: NextRequest) {
  const parsed = appointmentViewSchema.safeParse({
    view: request.nextUrl.searchParams.get("view") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid appointment view"), {
      status: 400,
    });
  }

  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  if (parsed.data.view === "patient") {
    if (session.role !== "patient") {
      return NextResponse.json(failure("FORBIDDEN", "Patient access required"), {
        status: 403,
      });
    }

    const requests = await listRequestsForPatient(session.user);
    return NextResponse.json(success({ view: "patient", appointments: requests }));
  }

  if (parsed.data.view === "provider") {
    if (session.role !== "provider" && session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.json(failure("FORBIDDEN", "Provider or admin access required"), {
        status: 403,
      });
    }
    if (session.role === "provider" && getProviderApprovalStatus(session.user) !== "approved") {
      return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
        status: 403,
      });
    }

    const { error, requests } = await listAllAppointmentRequests();
    if (error) {
      return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load appointments"), {
        status: 500,
      });
    }

    const scoped =
      session.role === "provider"
        ? requests.filter((item) => item.providerId === session.user.id)
        : requests;

    return NextResponse.json(success({ view: parsed.data.view, appointments: scoped }));
  }

  const { error, requests } = await listAllAppointmentRequests();
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load appointments"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ view: "admin", appointments: requests }));
}

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  if (getRoleFromUser(session.user) !== "patient") {
    return NextResponse.json(failure("FORBIDDEN", "Only patients can request appointments"), {
      status: 403,
    });
  }

  const onboarding = await getPatientOnboardingSnapshotForUser(session.user);
  if (onboarding.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to verify onboarding status"),
      { status: 500 },
    );
  }

  if (!onboarding.snapshot.readyForScheduling) {
    return NextResponse.json(
      failure("ONBOARDING_REQUIRED", "Complete onboarding before requesting appointments"),
      { status: 403 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Missing Idempotency-Key header"),
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = appointmentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid appointment create payload"),
      { status: 400 },
    );
  }

  const appointment = buildAppointmentRequest({
    patientUserId: session.user.id,
    patientEmail: session.user.email ?? "patient@example.com",
    providerId: parsed.data.providerId,
    providerSlotId: parsed.data.slotId,
    startsAt: parsed.data.startsAt,
    reason: parsed.data.reason,
    appointmentType: parsed.data.appointmentType,
  });

  const existingRequests = await listAllAppointmentRequests();
  if (existingRequests.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to validate appointment collisions"),
      { status: 500 },
    );
  }

  const hasConflict = existingRequests.requests.some((requestItem) => {
    if (requestItem.providerId !== parsed.data.providerId) return false;
    if (requestItem.startsAt !== parsed.data.startsAt) return false;
    return requestItem.status === "pending_provider_approval" || requestItem.status === "approved";
  });

  if (hasConflict) {
    return NextResponse.json(
      failure("SLOT_UNAVAILABLE", "Selected provider slot is already booked"),
      { status: 409 },
    );
  }

  const reservation = await reserveProviderSlot({
    providerUserId: parsed.data.providerId,
    startsAt: parsed.data.startsAt,
    slotId: parsed.data.slotId,
  });

  if (reservation.error || reservation.unavailable) {
    return NextResponse.json(
      failure("SLOT_UNAVAILABLE", "Selected provider slot is no longer available"),
      { status: 409 },
    );
  }

  const { error } = await appendAppointmentRequestForPatient(session.user, appointment);
  if (error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to create appointment request"),
      { status: 500 },
    );
  }

  await notifyAppointmentParticipants({
    patientUserId: appointment.patientUserId,
    providerUserId: appointment.providerId,
    appointmentId: appointment.id,
    type: "appointment_requested",
    patient: {
      title: "Appointment Request Submitted",
      message: `Your ${appointment.appointmentType} request for ${new Date(
        appointment.startsAt,
      ).toLocaleString()} is pending provider approval.`,
      dedupeKey: `appointment_requested:patient:${appointment.id}`,
    },
    provider: {
      title: "New Appointment Request",
      message: `Patient ${appointment.patientEmail} requested ${appointment.appointmentType} on ${new Date(
        appointment.startsAt,
      ).toLocaleString()}.`,
      dedupeKey: `appointment_requested:provider:${appointment.id}`,
    },
  });

  return NextResponse.json(success({ appointment, idempotencyKey }), { status: 201 });
}
