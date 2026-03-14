import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { onboardingSubmitSchema } from "@/lib/onboarding/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DRAFT_COOKIE_NAME = "vh_onboarding_draft";

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient"]);
  if (roleGuard) return roleGuard;

  const body = await request.json().catch(() => null);
  const parsed = onboardingSubmitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Onboarding submit payload is incomplete"),
      { status: 400 },
    );
  }

  const submittedAt = new Date().toISOString();
  const context = await ensureOrganizationContextForUser({
    user: session.user,
    roleOverride: "patient",
  });
  if (context.error || !context.organizationId) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve patient organization"),
      { status: 500 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("patient_profiles").upsert(
    {
      user_id: session.user.id,
      organization_id: context.organizationId,
      onboarding_status: "submitted",
      ready_for_scheduling: true,
      submitted_at: submittedAt,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: false,
    },
  );

  if (error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to persist onboarding submission"),
      { status: 500 },
    );
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: context.organizationId,
    action: "patient_onboarding.submitted",
    entityType: "patient_profile",
    entityId: session.user.id,
    details: {
      submittedAt,
      readyForScheduling: true,
    },
  });

  const response = NextResponse.json(
    success({
      status: "submitted",
      readyForScheduling: true,
      submittedAt,
    }),
  );

  response.cookies.delete(DRAFT_COOKIE_NAME);
  return response;
}
