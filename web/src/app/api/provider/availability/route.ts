import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import { deleteProviderSlot, listProviderSlots, createProviderSlot } from "@/lib/scheduling/store";
import { providerSlotCreateSchema, providerSlotDeleteSchema } from "@/lib/scheduling/schemas";

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

  const listed = await listProviderSlots(session.user);
  if (listed.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load availability"), {
      status: 500,
    });
  }
  return NextResponse.json(success({ slots: listed.slots }));
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

  return NextResponse.json(success({ deleted: true, slotId: parsed.data.slotId }));
}
