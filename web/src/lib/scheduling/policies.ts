import { z } from "zod";

import type { User } from "@supabase/supabase-js";

import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schedulingPolicySchema = z.object({
  cancellationMinHours: z.number().int().min(0).max(168),
  rescheduleMinHours: z.number().int().min(0).max(168),
});

export type SchedulingPolicy = z.infer<typeof schedulingPolicySchema>;

export function defaultSchedulingPolicy(): SchedulingPolicy {
  const cancellationMinHours = Number(process.env.SCHEDULING_CANCELLATION_MIN_HOURS ?? 4);
  const rescheduleMinHours = Number(process.env.SCHEDULING_RESCHEDULE_MIN_HOURS ?? 8);

  return schedulingPolicySchema.parse({
    cancellationMinHours,
    rescheduleMinHours,
  });
}

export async function getSchedulingPolicy(params?: { organizationId?: string | null }) {
  const fallback = defaultSchedulingPolicy();
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("scheduling_policies")
    .select("cancellation_min_hours, reschedule_min_hours")
    .limit(1);

  if (params?.organizationId) {
    query = query.eq("organization_id", params.organizationId);
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { error, policy: fallback };
  }

  if (!data) {
    return { error: null, policy: fallback };
  }

  const parsed = schedulingPolicySchema.safeParse(
    {
      cancellationMinHours: data.cancellation_min_hours,
      rescheduleMinHours: data.reschedule_min_hours,
    },
  );

  if (!parsed.success) {
    return { error: null, policy: fallback };
  }

  return { error: null, policy: parsed.data };
}

export async function updateSchedulingPolicyForAdmin(params: {
  adminUser: User;
  policy: SchedulingPolicy;
}) {
  const context = await ensureOrganizationContextForUser({
    user: params.adminUser,
    roleOverride: "admin",
  });
  if (context.error || !context.organizationId) {
    return { error: context.error ?? new Error("Unable to resolve admin organization") };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("scheduling_policies").upsert(
    {
      organization_id: context.organizationId,
      cancellation_min_hours: params.policy.cancellationMinHours,
      reschedule_min_hours: params.policy.rescheduleMinHours,
      updated_by_user_id: params.adminUser.id,
    },
    {
      onConflict: "organization_id",
      ignoreDuplicates: false,
    },
  );

  return { error };
}

export function hoursUntil(startsAt: string, now = Date.now()) {
  const startsAtTs = new Date(startsAt).valueOf();
  return (startsAtTs - now) / (1000 * 60 * 60);
}

export const schedulingPolicyUpdateSchema = schedulingPolicySchema;
