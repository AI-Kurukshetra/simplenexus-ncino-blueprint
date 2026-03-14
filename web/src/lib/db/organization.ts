import type { User } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/auth/roles";
import { getRoleFromUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  status: "active" | "invited" | "suspended";
};

function roleOrDefault(role: AppRole | null | undefined): AppRole {
  return role ?? "patient";
}

async function ensureDefaultOrganization() {
  const admin = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingError) return { error: existingError, organizationId: null as string | null };
  if (existing && existing.length > 0) {
    return { error: null, organizationId: existing[0].id as string };
  }

  const slug = "default-organization";
  const { data: created, error: createError } = await admin
    .from("organizations")
    .insert({
      slug,
      name: "Default Organization",
      specialty: "General Care",
    })
    .select("id")
    .single();

  if (createError) {
    const { data: fallback, error: fallbackError } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();
    if (fallbackError) {
      return { error: createError, organizationId: null as string | null };
    }
    return { error: null, organizationId: fallback.id as string };
  }

  return { error: null, organizationId: created.id as string };
}

async function getActiveMembershipForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_memberships")
    .select("organization_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) return { error, membership: null as MembershipRow | null };
  if (!data || data.length === 0) return { error: null, membership: null as MembershipRow | null };

  return {
    error: null,
    membership: {
      organization_id: data[0].organization_id as string,
      role: data[0].role as AppRole,
      status: data[0].status as MembershipRow["status"],
    },
  };
}

async function ensureMembership(params: {
  userId: string;
  organizationId: string;
  role: AppRole;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("organization_memberships").upsert(
    {
      organization_id: params.organizationId,
      user_id: params.userId,
      role: params.role,
      status: "active",
    },
    {
      onConflict: "organization_id,user_id",
      ignoreDuplicates: false,
    },
  );
  return { error };
}

async function ensureProfiles(params: {
  user: User;
  organizationId: string;
  role: AppRole;
}) {
  const admin = createSupabaseAdminClient();

  const fullName =
    (typeof params.user.user_metadata?.fullName === "string" && params.user.user_metadata.fullName) ||
    null;
  const phone =
    (typeof params.user.user_metadata?.phone === "string" && params.user.user_metadata.phone) ||
    null;

  const userProfile = await admin.from("user_profiles").upsert(
    {
      user_id: params.user.id,
      organization_id: params.organizationId,
      role: params.role,
      full_name: fullName,
      phone,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: false,
    },
  );
  if (userProfile.error) return { error: userProfile.error };

  if (params.role === "patient") {
    const onboardingStatus = params.user.user_metadata?.patientOnboarding?.status;
    const readyForScheduling = params.user.user_metadata?.patientOnboarding?.readyForScheduling;
    const submittedAt = params.user.user_metadata?.patientOnboarding?.submittedAt;

    const { error } = await admin.from("patient_profiles").upsert(
      {
        user_id: params.user.id,
        organization_id: params.organizationId,
        onboarding_status:
          onboardingStatus === "in_progress" || onboardingStatus === "submitted"
            ? onboardingStatus
            : "not_started",
        ready_for_scheduling: Boolean(readyForScheduling),
        submitted_at: typeof submittedAt === "string" ? submittedAt : null,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      },
    );
    return { error };
  }

  if (params.role === "provider") {
    const providerProfile =
      typeof params.user.user_metadata?.providerProfile === "object" &&
      params.user.user_metadata?.providerProfile
        ? (params.user.user_metadata.providerProfile as Record<string, unknown>)
        : null;

    const approvalStatus = params.user.app_metadata?.providerApprovalStatus;
    const accountStatus = params.user.app_metadata?.accountStatus;

    const { error } = await admin.from("provider_profiles").upsert(
      {
        user_id: params.user.id,
        organization_id: params.organizationId,
        approval_status:
          approvalStatus === "approved" || approvalStatus === "rejected"
            ? approvalStatus
            : "pending",
        account_status:
          accountStatus === "active" || accountStatus === "rejected"
            ? accountStatus
            : "pending_provider_approval",
        specialty:
          providerProfile && typeof providerProfile.specialty === "string"
            ? providerProfile.specialty
            : null,
        license_number:
          providerProfile && typeof providerProfile.licenseNumber === "string"
            ? providerProfile.licenseNumber
            : null,
        years_experience:
          providerProfile && typeof providerProfile.yearsExperience === "string"
            ? Number(providerProfile.yearsExperience) || null
            : null,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      },
    );
    return { error };
  }

  return { error: null };
}

export async function ensureOrganizationContextForUser(params: {
  user: User;
  roleOverride?: AppRole | null;
}) {
  const role = roleOrDefault(params.roleOverride ?? getRoleFromUser(params.user));
  const membership = await getActiveMembershipForUser(params.user.id);
  if (membership.error) {
    return { error: membership.error, organizationId: null as string | null, role };
  }

  let organizationId = membership.membership?.organization_id ?? null;
  if (!organizationId) {
    const ensuredOrg = await ensureDefaultOrganization();
    if (ensuredOrg.error || !ensuredOrg.organizationId) {
      return { error: ensuredOrg.error ?? new Error("Unable to resolve organization"), organizationId: null as string | null, role };
    }

    const ensuredMembership = await ensureMembership({
      userId: params.user.id,
      organizationId: ensuredOrg.organizationId,
      role,
    });
    if (ensuredMembership.error) {
      return { error: ensuredMembership.error, organizationId: null as string | null, role };
    }
    organizationId = ensuredOrg.organizationId;
  }

  const profileResult = await ensureProfiles({
    user: params.user,
    organizationId,
    role,
  });
  if (profileResult.error) {
    return { error: profileResult.error, organizationId: null as string | null, role };
  }

  return { error: null, organizationId, role };
}
