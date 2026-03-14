import type { User } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/auth/roles";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditDetails = Record<string, unknown>;
type AuditWriteInput = {
  actorUserId: string;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: AuditDetails;
};

type AuditFailureRow = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: AuditDetails;
  attempts: number;
  first_failed_at: string;
  last_failed_at: string;
};

function safeDetails(details: AuditDetails | undefined) {
  if (!details) return {};
  try {
    return JSON.parse(JSON.stringify(details)) as AuditDetails;
  } catch {
    return {};
  }
}

function toErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const withMessage = error as { message?: unknown };
    if (typeof withMessage.message === "string") return withMessage.message;
  }
  return "unknown_error";
}

export async function recordAuditLog(params: AuditWriteInput) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    organization_id: params.organizationId ?? null,
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    details: safeDetails(params.details),
  });

  return { error };
}

async function queueAuditLogFailure(params: AuditWriteInput & { errorMessage: string }) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_log_failures").insert({
    organization_id: params.organizationId ?? null,
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    details: safeDetails(params.details),
    error_message: params.errorMessage,
    attempts: 1,
    first_failed_at: new Date().toISOString(),
    last_failed_at: new Date().toISOString(),
    resolved_at: null,
  });
  return { error };
}

export async function recordAuditLogBestEffort(params: AuditWriteInput) {
  const result = await recordAuditLog(params);
  if (result.error) {
    const errorMessage = toErrorMessage(result.error);
    const queued = await queueAuditLogFailure({
      ...params,
      errorMessage,
    });

    console.error("audit_log_write_failed", {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      error: errorMessage,
      queuedFailure: !queued.error,
      queueError: queued.error ? toErrorMessage(queued.error) : null,
    });
  }
}

export async function recordAuditLogForActorBestEffort(params: {
  actorUser: User;
  actorRole?: AppRole | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: AuditDetails;
}) {
  const context = await ensureOrganizationContextForUser({
    user: params.actorUser,
    roleOverride: params.actorRole ?? undefined,
  });

  await recordAuditLogBestEffort({
    actorUserId: params.actorUser.id,
    organizationId: context.organizationId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  });
}

export async function getAuditFailureSummary(params?: { organizationId?: string | null }) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("audit_log_failures")
    .select("id, first_failed_at, last_failed_at")
    .is("resolved_at", null)
    .order("last_failed_at", { ascending: false });

  if (params?.organizationId) {
    query = query.eq("organization_id", params.organizationId);
  }

  const { data, error } = await query;
  if (error) {
    return {
      error,
      summary: {
        unresolvedCount: 0,
        oldestFailureAt: null as string | null,
        newestFailureAt: null as string | null,
      },
    };
  }

  const rows = data ?? [];
  const unresolvedCount = rows.length;
  const newestFailureAt = unresolvedCount > 0 ? (rows[0].last_failed_at as string) : null;
  const oldestFailureAt =
    unresolvedCount > 0 ? (rows[unresolvedCount - 1].first_failed_at as string) : null;

  return {
    error: null,
    summary: {
      unresolvedCount,
      oldestFailureAt,
      newestFailureAt,
    },
  };
}

export async function retryAuditLogFailures(params?: {
  organizationId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params?.limit ?? 50, 500));
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("audit_log_failures")
    .select(
      "id, organization_id, actor_user_id, action, entity_type, entity_id, details, attempts, first_failed_at, last_failed_at",
    )
    .is("resolved_at", null)
    .order("last_failed_at", { ascending: true })
    .limit(limit);

  if (params?.organizationId) {
    query = query.eq("organization_id", params.organizationId);
  }

  const { data, error } = await query;
  if (error) {
    return {
      error,
      stats: {
        picked: 0,
        retried: 0,
        resolved: 0,
        stillFailing: 0,
      },
    };
  }

  const rows = (data ?? []) as AuditFailureRow[];
  let resolved = 0;
  let stillFailing = 0;

  for (const row of rows) {
    if (!row.actor_user_id) {
      const { error: updateError } = await admin
        .from("audit_log_failures")
        .update({
          attempts: row.attempts + 1,
          last_failed_at: new Date().toISOString(),
          error_message: "missing_actor_user_id",
        })
        .eq("id", row.id);
      if (updateError) {
        console.error("audit_retry_update_failed", {
          id: row.id,
          error: toErrorMessage(updateError),
        });
      }
      stillFailing += 1;
      continue;
    }

    const write = await recordAuditLog({
      actorUserId: row.actor_user_id,
      organizationId: row.organization_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details,
    });

    if (!write.error) {
      const { error: resolveError } = await admin
        .from("audit_log_failures")
        .update({
          resolved_at: new Date().toISOString(),
          last_failed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (resolveError) {
        console.error("audit_retry_resolve_failed", {
          id: row.id,
          error: toErrorMessage(resolveError),
        });
      } else {
        resolved += 1;
      }
      continue;
    }

    const { error: updateError } = await admin
      .from("audit_log_failures")
      .update({
        attempts: row.attempts + 1,
        last_failed_at: new Date().toISOString(),
        error_message: toErrorMessage(write.error),
      })
      .eq("id", row.id);
    if (updateError) {
      console.error("audit_retry_update_failed", {
        id: row.id,
        error: toErrorMessage(updateError),
      });
    }
    stillFailing += 1;
  }

  return {
    error: null,
    stats: {
      picked: rows.length,
      retried: rows.length,
      resolved,
      stillFailing,
    },
  };
}
