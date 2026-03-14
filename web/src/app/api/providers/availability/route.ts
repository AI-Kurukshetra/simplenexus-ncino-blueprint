import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { listAvailableSlotsByProviderId } from "@/lib/scheduling/store";

const querySchema = z.object({
  providerId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const parsed = querySchema.safeParse({
    providerId: request.nextUrl.searchParams.get("providerId"),
  });

  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Missing providerId"), {
      status: 400,
    });
  }

  const { error, slots } = await listAvailableSlotsByProviderId(parsed.data.providerId);
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load provider availability"), {
      status: 500,
    });
  }

  return NextResponse.json(
    success({
      providerId: parsed.data.providerId,
      slots,
    }),
  );
}
