import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { insuranceVerificationSchema } from "@/lib/billing/schemas";
import { addInsuranceVerificationEvent } from "@/lib/billing/store";

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Admin access required"), { status: 403 });
  }

  const context = await ensureOrganizationContextForUser({
    user: session.user,
    roleOverride: session.role,
  });
  if (context.error || !context.organizationId) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization context"),
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = insuranceVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid verification payload"),
      { status: 400 },
    );
  }

  const result = await addInsuranceVerificationEvent({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    insurancePlanId: parsed.data.insurancePlanId,
    status: parsed.data.status,
    responseSummary: parsed.data.responseSummary,
  });
  if (result.notFound) {
    return NextResponse.json(failure("NOT_FOUND", "Insurance plan not found"), { status: 404 });
  }
  if (result.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to create verification event"),
      { status: 500 },
    );
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    action: "billing.insurance_verified_placeholder",
    entityType: "insurance_plan",
    entityId: parsed.data.insurancePlanId,
    details: {
      status: parsed.data.status,
      actorRole: session.role,
    },
  });

  return NextResponse.json(success({ verified: true, insurancePlanId: parsed.data.insurancePlanId }));
}
