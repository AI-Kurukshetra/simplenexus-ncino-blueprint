import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import {
  getAuditFailureSummary,
  recordAuditLogBestEffort,
  retryAuditLogFailures,
} from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { ensureOrganizationContextForUser } from "@/lib/db/organization";

const retrySchema = z.object({
  limit: z.number().int().min(1).max(500).default(100),
});

function warningLevel(unresolvedCount: number) {
  if (unresolvedCount >= 50) return "critical";
  if (unresolvedCount >= 10) return "high";
  if (unresolvedCount > 0) return "elevated";
  return "ok";
}

function warningMessage(unresolvedCount: number) {
  if (unresolvedCount >= 50) return "Audit retry queue is critically high";
  if (unresolvedCount >= 10) return "Audit retry queue needs attention";
  if (unresolvedCount > 0) return "Audit retry queue has pending failures";
  return "Audit retry queue is healthy";
}

async function resolveOrgScope(params: { user: User; role: "admin" | "super_admin" }) {
  if (params.role === "super_admin") {
    return { error: null, organizationId: null as string | null };
  }

  const context = await ensureOrganizationContextForUser({
    user: params.user,
    roleOverride: params.role,
  });
  if (context.error) {
    return { error: context.error, organizationId: null as string | null };
  }
  return { error: null, organizationId: context.organizationId };
}

export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Insufficient permissions"), { status: 403 });
  }

  const scope = await resolveOrgScope({
    user: session.user,
    role: session.role,
  });
  if (scope.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization scope"),
      { status: 500 },
    );
  }

  const summary = await getAuditFailureSummary({
    organizationId: scope.organizationId,
  });
  if (summary.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to load audit retry queue summary"),
      { status: 500 },
    );
  }

  return NextResponse.json(
    success({
      ...summary.summary,
      warningLevel: warningLevel(summary.summary.unresolvedCount),
      warningMessage: warningMessage(summary.summary.unresolvedCount),
    }),
  );
}

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json(failure("FORBIDDEN", "Insufficient permissions"), { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid audit retry payload"),
      { status: 400 },
    );
  }

  const scope = await resolveOrgScope({
    user: session.user,
    role: session.role,
  });
  if (scope.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to resolve organization scope"),
      { status: 500 },
    );
  }

  const retried = await retryAuditLogFailures({
    organizationId: scope.organizationId,
    limit: parsed.data.limit,
  });
  if (retried.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to execute audit retry"),
      { status: 500 },
    );
  }

  const summary = await getAuditFailureSummary({
    organizationId: scope.organizationId,
  });
  if (summary.error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to load post-retry summary"),
      { status: 500 },
    );
  }

  await recordAuditLogBestEffort({
    actorUserId: session.user.id,
    organizationId: scope.organizationId,
    action: "audit_retry.run",
    entityType: "audit_log_failures",
    entityId: null,
    details: {
      limit: parsed.data.limit,
      ...retried.stats,
      unresolvedAfter: summary.summary.unresolvedCount,
    },
  });

  return NextResponse.json(
    success({
      stats: retried.stats,
      summary: {
        ...summary.summary,
        warningLevel: warningLevel(summary.summary.unresolvedCount),
        warningMessage: warningMessage(summary.summary.unresolvedCount),
      },
    }),
  );
}
