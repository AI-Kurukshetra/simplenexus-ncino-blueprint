import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { getRoleFromUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProviderDirectoryItem = {
  id: string;
  email: string;
  fullName: string;
  specialty: string;
  licenseNumber: string;
  yearsExperience: string;
  approvalStatus: "pending" | "approved" | "rejected";
};

type ProviderProfileRow = {
  user_id: string;
  specialty: string | null;
  license_number: string | null;
  years_experience: number | null;
  approval_status: "pending" | "approved" | "rejected";
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
};

export async function listProviders() {
  const admin = createSupabaseAdminClient();
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) return { error: usersError, providers: [] as ProviderDirectoryItem[] };

  const providerUsers = usersData.users.filter((user) => getRoleFromUser(user) === "provider");
  const providerUserIdsFromAuth = new Set(providerUsers.map((user) => user.id));

  const { data: providerRows, error } = await admin
    .from("provider_profiles")
    .select("user_id, specialty, license_number, years_experience, approval_status")
    .order("created_at", { ascending: false });

  if (error) return { error, providers: [] as ProviderDirectoryItem[] };

  let providers = (providerRows ?? []) as ProviderProfileRow[];
  const existingProviderIds = new Set(providers.map((row) => row.user_id));
  const missingProviders = providerUsers.filter((user) => !existingProviderIds.has(user.id));

  for (const missingProvider of missingProviders) {
    await ensureOrganizationContextForUser({
      user: missingProvider,
      roleOverride: "provider",
    });
  }

  if (missingProviders.length > 0) {
    const refreshed = await admin
      .from("provider_profiles")
      .select("user_id, specialty, license_number, years_experience, approval_status")
      .order("created_at", { ascending: false });
    if (refreshed.error) {
      return { error: refreshed.error, providers: [] as ProviderDirectoryItem[] };
    }
    providers = (refreshed.data ?? []) as ProviderProfileRow[];
  }

  const providerUserIds = Array.from(
    new Set([...providers.map((row) => row.user_id), ...providerUserIdsFromAuth]),
  );

  if (providerUserIds.length === 0) {
    return { error: null, providers: [] as ProviderDirectoryItem[] };
  }

  const { data: userProfiles, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, full_name")
    .in("user_id", providerUserIds);
  if (profileError) return { error: profileError, providers: [] as ProviderDirectoryItem[] };

  const profileMap = new Map<string, UserProfileRow>(
    ((userProfiles ?? []) as UserProfileRow[]).map((row) => [row.user_id, row]),
  );

  const emailMap = new Map<string, string>(
    usersData.users.map((user) => [user.id, user.email ?? ""]),
  );

  const directory: ProviderDirectoryItem[] = providers.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      id: row.user_id,
      email: emailMap.get(row.user_id) ?? "",
      fullName: profile?.full_name || "Provider",
      specialty: row.specialty || "Not provided",
      licenseNumber: row.license_number || "Not provided",
      yearsExperience:
        typeof row.years_experience === "number" ? String(row.years_experience) : "-",
      approvalStatus: row.approval_status,
    };
  });

  return { error: null, providers: directory };
}

export async function setProviderApprovalStatus(params: {
  providerUserId: string;
  decision: "approved" | "rejected";
  approvedBy: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(params.providerUserId);
  if (error || !data.user) return { error: error ?? new Error("Provider not found") };

  const context = await ensureOrganizationContextForUser({
    user: data.user,
    roleOverride: "provider",
  });
  if (context.error || !context.organizationId) {
    return { error: context.error ?? new Error("Unable to resolve provider organization") };
  }

  const approvalAt = new Date().toISOString();
  const { error: profileError } = await admin
    .from("provider_profiles")
    .update({
      approval_status: params.decision,
      account_status: params.decision === "approved" ? "active" : "rejected",
      approved_by: params.approvedBy,
      approved_at: approvalAt,
    })
    .eq("user_id", params.providerUserId);

  if (profileError) return { error: profileError };

  return admin.auth.admin.updateUserById(params.providerUserId, {
    app_metadata: {
      ...(data.user.app_metadata ?? {}),
      role: "provider",
      providerApprovalStatus: params.decision,
      accountStatus: params.decision === "approved" ? "active" : "rejected",
    },
    user_metadata: {
      ...(data.user.user_metadata ?? {}),
      providerApprovedAt: approvalAt,
      providerApprovedBy: params.approvedBy,
    },
  });
}
