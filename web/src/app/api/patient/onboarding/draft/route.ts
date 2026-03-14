import { NextResponse, type NextRequest } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import {
  onboardingDraftSchema,
  onboardingDraftUpdateSchema,
} from "@/lib/onboarding/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DRAFT_COOKIE_NAME = "vh_onboarding_draft";

function safeParseCookieValue(raw: string | undefined) {
  if (!raw) return onboardingDraftSchema.parse({});
  try {
    const parsed = JSON.parse(raw);
    return onboardingDraftSchema.parse(parsed);
  } catch {
    return onboardingDraftSchema.parse({});
  }
}

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient"]);
  if (roleGuard) return roleGuard;

  const rawCookie = request.cookies.get(DRAFT_COOKIE_NAME)?.value;
  const draft = safeParseCookieValue(rawCookie);
  return NextResponse.json(success({ draft }));
}

export async function PUT(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient"]);
  if (roleGuard) return roleGuard;

  const body = await request.json().catch(() => null);
  const parsed = onboardingDraftUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid onboarding draft payload"),
      { status: 400 },
    );
  }

  const draftWithTimestamp = {
    ...parsed.data.draft,
    updatedAt: new Date().toISOString(),
  };

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
  const { data: profileRow, error: profileError } = await admin
    .from("patient_profiles")
    .select("onboarding_status")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to read onboarding progress"),
      { status: 500 },
    );
  }

  if (profileRow?.onboarding_status !== "submitted") {
    const { error } = await admin.from("patient_profiles").upsert(
      {
        user_id: session.user.id,
        organization_id: context.organizationId,
        onboarding_status: "in_progress",
        ready_for_scheduling: false,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      },
    );

    if (error) {
      return NextResponse.json(
        failure("INTERNAL_ERROR", "Unable to persist onboarding progress"),
        { status: 500 },
      );
    }
  }

  const response = NextResponse.json(success({ draft: draftWithTimestamp }));
  response.cookies.set(DRAFT_COOKIE_NAME, JSON.stringify(draftWithTimestamp), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
