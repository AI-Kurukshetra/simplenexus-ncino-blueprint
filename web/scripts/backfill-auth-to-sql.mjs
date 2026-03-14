import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const perPage = 200;

process.loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VALID_ROLES = new Set(["patient", "provider", "admin", "super_admin"]);
const VALID_ONBOARDING_STATUSES = new Set(["not_started", "in_progress", "submitted"]);
const VALID_APPROVAL_STATUSES = new Set(["pending", "approved", "rejected"]);
const VALID_ACCOUNT_STATUSES = new Set([
  "pending_provider_approval",
  "active",
  "rejected",
]);

function roleFromUser(user) {
  const appRole = String(user.app_metadata?.role || "").toLowerCase();
  if (VALID_ROLES.has(appRole)) return appRole;
  const userRole = String(user.user_metadata?.role || "").toLowerCase();
  if (VALID_ROLES.has(userRole)) return userRole;
  return "patient";
}

function stringOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function ensureDefaultOrganizationId() {
  const { data: existing, error: existingError } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length > 0) return existing[0].id;

  if (dryRun) return "dry-run-org-id";

  const { data: created, error: createdError } = await admin
    .from("organizations")
    .insert({
      slug: "default-organization",
      name: "Default Organization",
      specialty: "General Care",
    })
    .select("id")
    .single();

  if (createdError) {
    const { data: fallback, error: fallbackError } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", "default-organization")
      .single();
    if (fallbackError) throw createdError;
    return fallback.id;
  }

  return created.id;
}

async function listAllUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function getActiveMembershipMap() {
  const { data, error } = await admin
    .from("organization_memberships")
    .select("user_id, organization_id, status")
    .eq("status", "active");
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.user_id)) {
      map.set(row.user_id, row.organization_id);
    }
  }
  return map;
}

async function run() {
  const defaultOrganizationId = await ensureDefaultOrganizationId();
  const users = await listAllUsers();
  const activeMembershipByUser = await getActiveMembershipMap();

  let membershipsUpserted = 0;
  let userProfilesUpserted = 0;
  let patientProfilesUpserted = 0;
  let providerProfilesUpserted = 0;

  for (const user of users) {
    const role = roleFromUser(user);
    const organizationId = activeMembershipByUser.get(user.id) || defaultOrganizationId;

    const membershipRow = {
      organization_id: organizationId,
      user_id: user.id,
      role,
      status: "active",
    };
    const userProfileRow = {
      user_id: user.id,
      organization_id: organizationId,
      role,
      full_name: stringOrNull(user.user_metadata?.fullName),
      phone: stringOrNull(user.user_metadata?.phone),
    };

    if (!dryRun) {
      const { error: membershipError } = await admin
        .from("organization_memberships")
        .upsert(membershipRow, { onConflict: "organization_id,user_id", ignoreDuplicates: false });
      if (membershipError) throw membershipError;

      const { error: profileError } = await admin
        .from("user_profiles")
        .upsert(userProfileRow, { onConflict: "user_id", ignoreDuplicates: false });
      if (profileError) throw profileError;
    }
    membershipsUpserted += 1;
    userProfilesUpserted += 1;

    if (role === "patient") {
      const appOnboarding = user.app_metadata?.patientOnboarding;
      const userOnboarding = user.user_metadata?.patientOnboarding;
      const statusRaw = appOnboarding?.status ?? userOnboarding?.status;
      const onboardingStatus = VALID_ONBOARDING_STATUSES.has(statusRaw)
        ? statusRaw
        : "not_started";
      const readyForScheduling = Boolean(
        appOnboarding?.readyForScheduling ?? userOnboarding?.readyForScheduling,
      );
      const submittedAt = stringOrNull(appOnboarding?.submittedAt ?? userOnboarding?.submittedAt);

      if (!dryRun) {
        const { error: patientError } = await admin.from("patient_profiles").upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            onboarding_status: onboardingStatus,
            ready_for_scheduling: readyForScheduling,
            submitted_at: submittedAt,
          },
          {
            onConflict: "user_id",
            ignoreDuplicates: false,
          },
        );
        if (patientError) throw patientError;
      }
      patientProfilesUpserted += 1;
      continue;
    }

    if (role === "provider") {
      const providerProfile =
        user.user_metadata?.providerProfile && typeof user.user_metadata.providerProfile === "object"
          ? user.user_metadata.providerProfile
          : {};
      const approvalRaw = user.app_metadata?.providerApprovalStatus ?? "pending";
      const accountRaw = user.app_metadata?.accountStatus ?? "pending_provider_approval";

      const approvalStatus = VALID_APPROVAL_STATUSES.has(approvalRaw) ? approvalRaw : "pending";
      const accountStatus = VALID_ACCOUNT_STATUSES.has(accountRaw)
        ? accountRaw
        : "pending_provider_approval";

      if (!dryRun) {
        const { error: providerError } = await admin.from("provider_profiles").upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            approval_status: approvalStatus,
            account_status: accountStatus,
            specialty: stringOrNull(providerProfile.specialty),
            license_number: stringOrNull(providerProfile.licenseNumber),
            years_experience: numberOrNull(providerProfile.yearsExperience),
          },
          {
            onConflict: "user_id",
            ignoreDuplicates: false,
          },
        );
        if (providerError) throw providerError;
      }
      providerProfilesUpserted += 1;
    }
  }

  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Users scanned: ${users.length}`);
  console.log(`Memberships upserted: ${membershipsUpserted}`);
  console.log(`User profiles upserted: ${userProfilesUpserted}`);
  console.log(`Patient profiles upserted: ${patientProfilesUpserted}`);
  console.log(`Provider profiles upserted: ${providerProfilesUpserted}`);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
