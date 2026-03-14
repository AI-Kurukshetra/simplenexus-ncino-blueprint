import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { listNotificationsForUser } from "@/lib/notifications/store";

const querySchema = z.object({
  unread: z.enum(["0", "1"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const parsed = querySchema.safeParse({
    unread: request.nextUrl.searchParams.get("unread") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid notifications query"), {
      status: 400,
    });
  }

  const unreadOnly = parsed.data.unread === "1";
  const data = await listNotificationsForUser(session.user, {
    unreadOnly,
    limit: parsed.data.limit,
  });

  return NextResponse.json(success(data));
}
