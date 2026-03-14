import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { listProviders } from "@/lib/providers/store";

export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const { error, providers } = await listProviders();
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load providers"), {
      status: 500,
    });
  }

  const approvedProviders = providers.filter((provider) => provider.approvalStatus === "approved");
  return NextResponse.json(success({ providers: approvedProviders }));
}
