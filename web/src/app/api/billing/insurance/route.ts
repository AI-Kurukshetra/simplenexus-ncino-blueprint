import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { insurancePlanUpsertSchema, insurancePlanViewSchema } from "@/lib/billing/schemas";
import {
  listInsurancePlansForOrganization,
  listInsurancePlansForPatient,
  upsertInsurancePlan,
} from "@/lib/billing/store";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const parsed = insurancePlanViewSchema.safeParse({
    patientUserId: request.nextUrl.searchParams.get("patientUserId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid insurance query"), { status: 400 });
  }

  if (session.role === "patient") {
    const listed = await listInsurancePlansForPatient(session.user.id);
    if (listed.error) {
      return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load insurance plans"), {
        status: 500,
      });
    }
    return NextResponse.json(success({ plans: listed.plans, scope: "patient" }));
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

  if (parsed.data.patientUserId) {
    const listed = await listInsurancePlansForPatient(parsed.data.patientUserId);
    if (listed.error) {
      return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load insurance plans"), {
        status: 500,
      });
    }
    return NextResponse.json(
      success({ plans: listed.plans, scope: "patient", patientUserId: parsed.data.patientUserId }),
    );
  }

  const listed = await listInsurancePlansForOrganization(context.organizationId);
  if (listed.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load insurance plans"), {
      status: 500,
    });
  }
  return NextResponse.json(success({ plans: listed.plans, scope: "organization" }));
}

export async function PUT(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

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
  const parsed = insurancePlanUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid insurance plan payload"),
      { status: 400 },
    );
  }

  const targetPatientUserId =
    session.role === "patient" ? session.user.id : parsed.data.patientUserId;

  if (!targetPatientUserId) {
    return NextResponse.json(
      failure("BAD_REQUEST", "patientUserId is required for admin updates"),
      { status: 400 },
    );
  }

  const saved = await upsertInsurancePlan({
    organizationId: context.organizationId,
    patientUserId: targetPatientUserId,
    payerName: parsed.data.payerName,
    memberId: parsed.data.memberId,
    groupNumber: parsed.data.groupNumber,
    planType: parsed.data.planType,
    subscriberName: parsed.data.subscriberName,
    relationshipToSubscriber: parsed.data.relationshipToSubscriber,
    coverageStatus: parsed.data.coverageStatus,
  });
  if (saved.error || !saved.plan) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to save insurance plan"), {
      status: 500,
    });
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    action: "billing.insurance_plan_upserted",
    entityType: "insurance_plan",
    entityId: saved.plan.id,
    details: {
      patientUserId: targetPatientUserId,
      coverageStatus: saved.plan.coverageStatus,
      verificationStatus: saved.plan.verificationStatus,
      actorRole: session.role,
    },
  });

  return NextResponse.json(success({ plan: saved.plan, updated: true }));
}
