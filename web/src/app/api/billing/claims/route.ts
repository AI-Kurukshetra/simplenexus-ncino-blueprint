import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { claimCreateSchema } from "@/lib/billing/schemas";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createClaimForInvoice, listClaimsForOrganization } from "@/lib/billing/store";

export async function GET() {
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

  const listed = await listClaimsForOrganization(context.organizationId);
  if (listed.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load claims"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ claims: listed.claims }));
}

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
  const parsed = claimCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid claim create payload"), {
      status: 400,
    });
  }

  const created = await createClaimForInvoice({
    organizationId: context.organizationId,
    invoiceId: parsed.data.invoiceId,
    payerName: parsed.data.payerName,
    actorUserId: session.user.id,
  });

  if (created.notFound) {
    return NextResponse.json(failure("NOT_FOUND", "Invoice not found"), { status: 404 });
  }
  if (created.conflict) {
    return NextResponse.json(failure("INVALID_STATE", "Claim already exists for this invoice"), {
      status: 409,
    });
  }
  if (created.error || !created.claim) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to create claim"), {
      status: 500,
    });
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    action: "billing.claim_created",
    entityType: "claim",
    entityId: created.claim.id,
    details: {
      invoiceId: created.claim.invoiceId,
      patientUserId: created.claim.patientUserId,
      status: created.claim.status,
      payerName: created.claim.payerName,
    },
  });

  return NextResponse.json(success({ claim: created.claim }), { status: 201 });
}
