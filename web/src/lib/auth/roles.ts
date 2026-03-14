export const APP_ROLES = ["patient", "provider", "admin", "super_admin"] as const;
export const SIGN_UP_ROLES = ["patient", "provider"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type SignUpRole = (typeof SIGN_UP_ROLES)[number];
export type ProviderApprovalStatus = "pending" | "approved" | "rejected";
export type PatientOnboardingStatus = "not_started" | "in_progress" | "submitted";

type UserLike = {
  id?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const role = value.toLowerCase();
  return APP_ROLES.includes(role as AppRole) ? (role as AppRole) : null;
}

function metadataObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function getRoleFromUser(user: UserLike): AppRole | null {
  if (!user) return null;

  const appRole = normalizeRole(user.app_metadata?.role);
  if (appRole) return appRole;

  const metadataRole = normalizeRole(user.user_metadata?.role);
  if (metadataRole) return metadataRole;

  return null;
}

export function getDefaultHomeForRole(role: AppRole | null): string {
  if (!role) return "/app/patient/dashboard";
  if (role === "patient") return "/app/patient/dashboard";
  if (role === "provider") return "/app/provider/dashboard";
  return "/app/admin/dashboard";
}

export function getProviderApprovalStatus(user: UserLike): ProviderApprovalStatus | null {
  if (!user) return null;
  const appValue = user.app_metadata?.providerApprovalStatus;
  if (appValue === "pending" || appValue === "approved" || appValue === "rejected") {
    return appValue;
  }

  const value = user.user_metadata?.providerApprovalStatus;
  if (typeof value !== "string") return null;
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return null;
}

export function isProviderPendingApproval(user: UserLike): boolean {
  const role = getRoleFromUser(user);
  if (role !== "provider") return false;
  return getProviderApprovalStatus(user) !== "approved";
}

export function getDefaultHomeForUser(user: UserLike): string {
  const role = getRoleFromUser(user);
  if (role === "provider") {
    const approvalStatus = getProviderApprovalStatus(user);
    if (approvalStatus === "rejected") return "/app/provider/pending-approval?state=rejected";
    if (approvalStatus !== "approved") return "/app/provider/pending-approval?state=pending";
  }
  return getDefaultHomeForRole(role);
}

export function canAccessPath(role: AppRole | null, pathname: string): boolean {
  if (!pathname.startsWith("/app")) return true;
  if (!role) return false;

  if (pathname.startsWith("/app/patient")) return role === "patient";
  if (pathname.startsWith("/app/provider")) return role === "provider";
  if (pathname.startsWith("/app/admin")) return role === "admin" || role === "super_admin";

  return true;
}

export function canAccessPathForUser(user: UserLike, pathname: string): boolean {
  const role = getRoleFromUser(user);
  const providerPending = isProviderPendingApproval(user);

  if (providerPending) {
    if (pathname.startsWith("/app/provider/pending-approval")) return true;
    if (pathname === "/app" || pathname === "/app/") return true;
    return false;
  }

  return canAccessPath(role, pathname);
}

export function sanitizeNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath || typeof nextPath !== "string") return null;
  if (!nextPath.startsWith("/")) return null;
  if (nextPath.startsWith("//")) return null;
  return nextPath;
}

export function getPatientOnboardingStatus(user: UserLike): PatientOnboardingStatus {
  if (!user) return "not_started";

  const appOnboarding = metadataObject(user.app_metadata?.patientOnboarding);
  const userOnboarding = metadataObject(user.user_metadata?.patientOnboarding);
  const source = appOnboarding ?? userOnboarding;

  if (!source) return "not_started";
  if (source.status === "submitted") return "submitted";
  if (source.status === "in_progress") return "in_progress";
  return "not_started";
}

export function isPatientReadyForScheduling(user: UserLike): boolean {
  if (!user) return false;

  const appOnboarding = metadataObject(user.app_metadata?.patientOnboarding);
  if (typeof appOnboarding?.readyForScheduling === "boolean") {
    return appOnboarding.readyForScheduling;
  }

  const userOnboarding = metadataObject(user.user_metadata?.patientOnboarding);
  if (typeof userOnboarding?.readyForScheduling === "boolean") {
    return userOnboarding.readyForScheduling;
  }

  return getPatientOnboardingStatus(user) === "submitted";
}
