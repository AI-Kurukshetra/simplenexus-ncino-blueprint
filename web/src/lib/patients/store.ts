import type { User } from "@supabase/supabase-js";

import { getRoleFromUser, type PatientOnboardingStatus } from "@/lib/auth/roles";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PatientDirectoryItem = {
  id: string;
  email: string;
  fullName: string;
  onboardingStatus: PatientOnboardingStatus;
  readyForScheduling: boolean;
  submittedAt: string | null;
  appointmentRequestCount: number;
  createdAt: string;
};

type PatientProfileRow = {
  user_id: string;
  onboarding_status: PatientOnboardingStatus;
  ready_for_scheduling: boolean;
  submitted_at: string | null;
  created_at: string;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  created_at: string;
};

type AppointmentPatientRow = {
  patient_user_id: string;
};

type PatientOnboardingSnapshot = {
  onboardingStatus: PatientOnboardingStatus;
  readyForScheduling: boolean;
  submittedAt: string | null;
};

export async function getPatientOnboardingSnapshotForUser(
  user: User,
): Promise<{ error: unknown | null; snapshot: PatientOnboardingSnapshot }> {
  const context = await ensureOrganizationContextForUser({
    user,
    roleOverride: "patient",
  });
  if (context.error) {
    return {
      error: context.error,
      snapshot: {
        onboardingStatus: "not_started",
        readyForScheduling: false,
        submittedAt: null,
      },
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("patient_profiles")
    .select("onboarding_status, ready_for_scheduling, submitted_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      error,
      snapshot: {
        onboardingStatus: "not_started",
        readyForScheduling: false,
        submittedAt: null,
      },
    };
  }

  return {
    error: null,
    snapshot: {
      onboardingStatus: data.onboarding_status as PatientOnboardingStatus,
      readyForScheduling: Boolean(data.ready_for_scheduling),
      submittedAt: (data.submitted_at as string | null) ?? null,
    },
  };
}

export async function listPatients() {
  const admin = createSupabaseAdminClient();
  const { data: authUsersData, error: authUsersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authUsersError) return { error: authUsersError, patients: [] as PatientDirectoryItem[] };

  const patientUsers = authUsersData.users.filter((authUser) => getRoleFromUser(authUser) === "patient");
  const patientUserIdsFromAuth = new Set(patientUsers.map((patientUser) => patientUser.id));

  const { data: patientRows, error } = await admin
    .from("patient_profiles")
    .select("user_id, onboarding_status, ready_for_scheduling, submitted_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error, patients: [] as PatientDirectoryItem[] };

  let patientsData = (patientRows ?? []) as PatientProfileRow[];
  const existingPatientIds = new Set(patientsData.map((row) => row.user_id));
  const missingPatients = patientUsers.filter((patientUser) => !existingPatientIds.has(patientUser.id));

  for (const missingPatient of missingPatients) {
    await ensureOrganizationContextForUser({
      user: missingPatient,
      roleOverride: "patient",
    });
  }

  if (missingPatients.length > 0) {
    const refreshed = await admin
      .from("patient_profiles")
      .select("user_id, onboarding_status, ready_for_scheduling, submitted_at, created_at")
      .order("created_at", { ascending: false });
    if (refreshed.error) {
      return { error: refreshed.error, patients: [] as PatientDirectoryItem[] };
    }
    patientsData = (refreshed.data ?? []) as PatientProfileRow[];
  }

  const patientUserIds = Array.from(
    new Set([...patientsData.map((row) => row.user_id), ...patientUserIdsFromAuth]),
  );

  if (patientUserIds.length === 0) {
    return { error: null, patients: [] as PatientDirectoryItem[] };
  }

  const { data: userProfiles, error: userProfileError } = await admin
    .from("user_profiles")
    .select("user_id, full_name, created_at")
    .in("user_id", patientUserIds);
  if (userProfileError) return { error: userProfileError, patients: [] as PatientDirectoryItem[] };

  const userProfileMap = new Map<string, UserProfileRow>(
    ((userProfiles ?? []) as UserProfileRow[]).map((row) => [row.user_id, row]),
  );

  const { data: appointmentRows, error: appointmentError } = await admin
    .from("appointment_requests")
    .select("patient_user_id")
    .in("patient_user_id", patientUserIds);
  if (appointmentError) return { error: appointmentError, patients: [] as PatientDirectoryItem[] };

  const appointmentCountByPatient = new Map<string, number>();
  for (const row of (appointmentRows ?? []) as AppointmentPatientRow[]) {
    const current = appointmentCountByPatient.get(row.patient_user_id) ?? 0;
    appointmentCountByPatient.set(row.patient_user_id, current + 1);
  }

  const emailMap = new Map<string, string>(
    authUsersData.users.map((authUser) => [authUser.id, authUser.email ?? ""]),
  );
  const authCreatedAtMap = new Map<string, string>(
    authUsersData.users.map((authUser) => [authUser.id, authUser.created_at]),
  );

  const patients: PatientDirectoryItem[] = patientsData.map((patient) => {
    const profile = userProfileMap.get(patient.user_id);
    return {
      id: patient.user_id,
      email: emailMap.get(patient.user_id) ?? "",
      fullName: profile?.full_name || "Patient",
      onboardingStatus: patient.onboarding_status,
      readyForScheduling: Boolean(patient.ready_for_scheduling),
      submittedAt: patient.submitted_at,
      appointmentRequestCount: appointmentCountByPatient.get(patient.user_id) ?? 0,
      createdAt:
        authCreatedAtMap.get(patient.user_id) ||
        profile?.created_at ||
        patient.created_at,
    };
  });

  return { error: null, patients };
}
