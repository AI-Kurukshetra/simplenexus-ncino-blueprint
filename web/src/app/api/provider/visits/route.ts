import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { getProviderApprovalStatus } from "@/lib/auth/roles";
import { listApprovedVisitsForProvider } from "@/lib/provider-visits/store";

export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["provider"]);
  if (roleGuard) return roleGuard;

  if (getProviderApprovalStatus(session.user) !== "approved") {
    return NextResponse.json(failure("FORBIDDEN", "Provider approval required"), {
      status: 403,
    });
  }

  const listed = await listApprovedVisitsForProvider(session.user);
  if (listed.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load provider visits"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ visits: listed.visits }));
}
