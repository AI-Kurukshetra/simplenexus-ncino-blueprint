import { NextResponse } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { recordAuditLogForActorBestEffort } from "@/lib/audit/store";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { setProviderApprovalStatus } from "@/lib/providers/store";

const approvalSchema = z.object({
  providerUserId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const body = await request.json().catch(() => null);
  const parsed = approvalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid provider approval payload"), {
      status: 400,
    });
  }

  const { error, invalidState } = await setProviderApprovalStatus({
    providerUserId: parsed.data.providerUserId,
    decision: parsed.data.decision,
    approvedBy: session.user.id,
  });

  if (invalidState) {
    return NextResponse.json(
      failure("INVALID_STATE", "Only pending providers can be approved or rejected"),
      { status: 409 },
    );
  }

  if (error) {
    return NextResponse.json(
      failure("INTERNAL_ERROR", "Unable to update provider approval status"),
      { status: 500 },
    );
  }

  await recordAuditLogForActorBestEffort({
    actorUser: session.user,
    actorRole: session.role,
    action: parsed.data.decision === "approved" ? "provider.approved" : "provider.rejected",
    entityType: "provider_profile",
    entityId: parsed.data.providerUserId,
    details: {
      providerUserId: parsed.data.providerUserId,
      decision: parsed.data.decision,
    },
  });

  return NextResponse.json(success({ updated: true, decision: parsed.data.decision }));
}
