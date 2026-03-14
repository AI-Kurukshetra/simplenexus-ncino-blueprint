import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import {
  getSchedulingPolicy,
  schedulingPolicyUpdateSchema,
  updateSchedulingPolicyForAdmin,
} from "@/lib/scheduling/policies";

export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const context = await ensureOrganizationContextForUser({
    user: session.user,
    roleOverride: session.role,
  });
  if (context.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization context"),
      { status: 500 },
    );
  }

  const { error, policy } = await getSchedulingPolicy({
    organizationId: context.organizationId,
  });
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load scheduling policy"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ policy }));
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const context = await ensureOrganizationContextForUser({
    user: session.user,
    roleOverride: session.role,
  });
  if (context.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization context"),
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schedulingPolicyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid scheduling policy payload"),
      { status: 400 },
    );
  }

  const { error } = await updateSchedulingPolicyForAdmin({
    adminUser: session.user,
    policy: parsed.data,
  });

  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to update policy"), {
      status: 500,
    });
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    action: "scheduling_policy.updated",
    entityType: "scheduling_policy",
    entityId: context.organizationId,
    details: {
      cancellationMinHours: parsed.data.cancellationMinHours,
      rescheduleMinHours: parsed.data.rescheduleMinHours,
    },
  });

  return NextResponse.json(success({ policy: parsed.data, updated: true }));
}
