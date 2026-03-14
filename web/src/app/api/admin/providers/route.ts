import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { listProviders } from "@/lib/providers/store";

const statusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
});

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const parsed = statusSchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? "pending",
  });
  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid status filter"), {
      status: 400,
    });
  }

  const { error, providers } = await listProviders();
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load providers"), {
      status: 500,
    });
  }

  const filtered =
    parsed.data.status === "all"
      ? providers
      : providers.filter((provider) => provider.approvalStatus === parsed.data.status);

  return NextResponse.json(success({ providers: filtered, filter: parsed.data.status }));
}
