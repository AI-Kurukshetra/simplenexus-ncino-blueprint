import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogForActorBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import {
  createProviderSlot,
  deleteProviderSlot,
  listProviderSlots,
  listProviderWeeklySchedule,
  upsertProviderWeeklySchedule,
} from "@/lib/scheduling/store";
import {
  providerSlotCreateSchema,
  providerSlotDeleteSchema,
  providerWeeklyScheduleUpsertSchema,
} from "@/lib/scheduling/schemas";

export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["provider"]);
  if (roleGuard) return roleGuard;

  if (getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const [listed, weekly] = await Promise.all([
    listProviderSlots(session.user),
    listProviderWeeklySchedule(session.user),
  ]);
  if (listed.error || weekly.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load availability"), {
      status: 500,
    });
  }
  return NextResponse.json(success({ slots: listed.slots, weeklySchedule: weekly.schedule }));
}

export async function POST(request: NextRequest) {
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
  const parsed = providerSlotCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid availability slot payload"), {
      status: 400,
    });
  }

  const created = await createProviderSlot({
    provider: session.user,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
  });

  if (created.conflict) {
    return NextResponse.json(
      failure("SLOT_CONFLICT", "Availability slot overlaps an existing slot"),
      { status: 409 },
    );
  }

  if (created.error || !created.slot) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to create slot"), {
      status: 500,
    });
  }

  await recordAuditLogForActorBestEffort({
    actorUser: session.user,
    actorRole: session.role,
    action: "provider_availability.created",
    entityType: "provider_availability_slot",
    entityId: created.slot.id,
    details: {
      startsAt: created.slot.startsAt,
      endsAt: created.slot.endsAt,
      status: created.slot.status,
    },
  });

  return NextResponse.json(success({ slot: created.slot }), { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["provider"]);
  if (roleGuard) return roleGuard;

  if (getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const parsed = providerSlotDeleteSchema.safeParse({
    slotId: request.nextUrl.searchParams.get("slotId"),
  });
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Missing or invalid slotId"), {
      status: 400,
    });
  }

  const removed = await deleteProviderSlot({
    provider: session.user,
    slotId: parsed.data.slotId,
  });

  if (removed.notFound) {
    return NextResponse.json(failure("NOT_FOUND", "Slot not found"), { status: 404 });
  }

  if (removed.forbidden) {
    return NextResponse.json(
      failure("FORBIDDEN", "Booked slots cannot be deleted"),
      { status: 403 },
    );
  }

  if (removed.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to delete slot"), {
      status: 500,
    });
  }

  await recordAuditLogForActorBestEffort({
    actorUser: session.user,
    actorRole: session.role,
    action: "provider_availability.deleted",
    entityType: "provider_availability_slot",
    entityId: parsed.data.slotId,
    details: {
      slotId: parsed.data.slotId,
    },
  });

  return NextResponse.json(success({ deleted: true, slotId: parsed.data.slotId }));
}

export async function PUT(request: NextRequest) {
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
  const parsed = providerWeeklyScheduleUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid weekly schedule payload"),
      { status: 400 },
    );
  }

  const updated = await upsertProviderWeeklySchedule({
    provider: session.user,
    timezone: parsed.data.timezone,
    slotDurationMinutes: parsed.data.slotDurationMinutes as 15 | 30 | 45 | 60,
    horizonDays: parsed.data.horizonDays,
    windows: parsed.data.windows,
  });

  if (updated.error || !updated.schedule) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to update weekly schedule"),
      { status: 500 },
    );
  }

  await recordAuditLogForActorBestEffort({
    actorUser: session.user,
    actorRole: session.role,
    action: "provider_availability.weekly_schedule_upserted",
    entityType: "provider_weekly_schedule",
    entityId: session.user.id,
    details: {
      timezone: updated.schedule.timezone,
      slotDurationMinutes: updated.schedule.slotDurationMinutes,
      generatedCount: updated.generatedCount,
      skippedConflicts: updated.skippedConflicts,
      enabledDays: updated.schedule.windows.filter((window) => window.enabled).map((window) => window.dayOfWeek),
    },
  });

  const listed = await listProviderSlots(session.user);
  if (listed.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Schedule updated but slots could not be loaded"),
      { status: 500 },
    );
  }

  return NextResponse.json(
    success({
      weeklySchedule: updated.schedule,
      slots: listed.slots,
      generatedCount: updated.generatedCount,
      skippedConflicts: updated.skippedConflicts,
    }),
  );
}
