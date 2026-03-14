"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  SIGN_UP_ROLES,
  getDefaultHomeForRole,
  getDefaultHomeForUser,
  sanitizeNextPath,
} from "@/lib/auth/roles";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(SIGN_UP_ROLES),
  fullName: z.string().min(2).max(120),
  phone: z.string().optional().default(""),
  providerSpecialty: z.string().optional().default(""),
  providerLicenseNumber: z.string().optional().default(""),
  providerYearsExperience: z.string().optional().default(""),
}).superRefine((value, ctx) => {
  if (value.role !== "provider") return;

  if (!value.providerSpecialty.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["providerSpecialty"],
      message: "Provider specialty is required",
    });
  }

  if (!value.providerLicenseNumber.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["providerLicenseNumber"],
      message: "Provider license number is required",
    });
  }
});

const resetRequestSchema = z.object({
  email: z.email(),
});

const updatePasswordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

const inviteAcceptSchema = z.object({
  inviteCode: z.string().min(6),
});

function roleFromInviteCode(inviteCode: string) {
  const normalized = inviteCode.toLowerCase();
  if (normalized.startsWith("adm_")) return "admin";
  if (normalized.startsWith("pro_")) return "provider";
  return "patient";
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function signupErrorCode(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("already registered")) return "email_in_use";
  if (message.includes("rate limit")) return "rate_limited";
  if (message.includes("invalid email")) return "invalid_email";
  if (message.includes("password")) return "weak_password";
  return "signup_failed";
}

export async function signInWithPassword(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    redirect("/sign-in?error=invalid_form");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    redirect("/sign-in?error=invalid_credentials");
  }

  const safeNext = sanitizeNextPath(parsed.data.next);
  redirect(safeNext ?? getDefaultHomeForUser(data.user));
}

export async function signUpWithPassword(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    providerSpecialty: formData.get("providerSpecialty"),
    providerLicenseNumber: formData.get("providerLicenseNumber"),
    providerYearsExperience: formData.get("providerYearsExperience"),
  });

  if (!parsed.success) {
    redirect("/sign-up?error=invalid_form");
  }

  const providerPending = parsed.data.role === "provider";
  const rolePayload = {
    role: parsed.data.role,
    providerApprovalStatus: providerPending ? "pending" : "approved",
    accountStatus: providerPending ? "pending_provider_approval" : "active",
  } as const;
  const userPayload = {
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    requestedRole: parsed.data.role,
    providerProfile:
      parsed.data.role === "provider"
        ? {
            specialty: parsed.data.providerSpecialty,
            licenseNumber: parsed.data.providerLicenseNumber,
            yearsExperience: parsed.data.providerYearsExperience,
            submittedAt: new Date().toISOString(),
          }
        : null,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
      data: {
        ...userPayload,
      },
    },
  });

  if (error) {
    const isRateLimited = signupErrorCode(error) === "rate_limited";
    if (isRateLimited && process.env.NODE_ENV !== "production") {
      const admin = createSupabaseAdminClient();
      const created = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        app_metadata: {
          ...rolePayload,
        },
        user_metadata: {
          ...userPayload,
        },
      });

      if (!created.error && created.data.user) {
        const profileContext = await ensureOrganizationContextForUser({
          user: created.data.user,
          roleOverride: parsed.data.role,
        });
        if (profileContext.error) {
          console.error("signup profile bootstrap failed after admin fallback", {
            userId: created.data.user.id,
            role: parsed.data.role,
            error: profileContext.error,
          });
        }

        if (providerPending) {
          redirect("/sign-in?message=provider_pending");
        }
        redirect("/sign-in?message=account_created");
      }
    }

    redirect(`/sign-up?error=${signupErrorCode(error)}`);
  }

  if (data.user) {
    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: {
        ...(data.user.app_metadata ?? {}),
        ...rolePayload,
      },
      user_metadata: {
        ...(data.user.user_metadata ?? {}),
        ...userPayload,
      },
    });

    if (updateError) {
      redirect("/sign-up?error=signup_failed");
    }

    const { data: refreshedUserData, error: refreshError } = await admin.auth.admin.getUserById(
      data.user.id,
    );
    if (refreshError || !refreshedUserData.user) {
      redirect("/sign-up?error=signup_failed");
    }

    const profileContext = await ensureOrganizationContextForUser({
      user: refreshedUserData.user,
      roleOverride: parsed.data.role,
    });
    if (profileContext.error) {
      console.error("signup profile bootstrap failed", {
        userId: data.user.id,
        role: parsed.data.role,
        error: profileContext.error,
      });
    }
  }

  if (data.user && data.session) {
    if (providerPending) {
      redirect("/app/provider/pending-approval?state=pending");
    }
    redirect("/app/patient/dashboard");
  }

  if (providerPending) {
    redirect("/sign-in?message=provider_pending");
  }

  redirect("/sign-in?message=check_email");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in?message=signed_out");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = resetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect("/forgot-password?error=invalid_email");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect("/forgot-password?error=request_failed");
  }

  redirect("/forgot-password?message=check_email");
}

export async function updatePassword(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect("/reset-password?error=password_mismatch");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    redirect("/reset-password?error=update_failed");
  }

  redirect("/sign-in?message=password_updated");
}

export async function acceptInvite(formData: FormData) {
  const parsed = inviteAcceptSchema.safeParse({
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success) {
    redirect("/invite/accept?error=invalid_code");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?error=invite_requires_login&next=/invite/accept");
  }

  const role = roleFromInviteCode(parsed.data.inviteCode);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      role,
      providerApprovalStatus: role === "provider" ? "approved" : user.app_metadata?.providerApprovalStatus,
      accountStatus: "active",
    },
    user_metadata: {
      ...(user.user_metadata ?? {}),
      inviteAcceptedAt: new Date().toISOString(),
      inviteCode: parsed.data.inviteCode,
    },
  });

  if (error) {
    redirect("/invite/accept?error=accept_failed");
  }

  const { data: refreshedUserData, error: refreshError } = await admin.auth.admin.getUserById(
    user.id,
  );
  if (refreshError || !refreshedUserData.user) {
    redirect("/invite/accept?error=accept_failed");
  }

  const profileContext = await ensureOrganizationContextForUser({
    user: refreshedUserData.user,
    roleOverride: role,
  });
  if (profileContext.error) {
    redirect("/invite/accept?error=accept_failed");
  }

  redirect(getDefaultHomeForRole(role));
}
