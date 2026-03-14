import { NextResponse } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { markNotificationRead } from "@/lib/notifications/store";

const payloadSchema = z.object({
  notificationId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["patient", "provider", "admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid read payload"), { status: 400 });
  }

  const result = await markNotificationRead({
    user: session.user,
    notificationId: parsed.data.notificationId,
  });

  if (result.error) {
    if (result.error.message === "Notification not found") {
      return NextResponse.json(failure("NOT_FOUND", result.error.message), { status: 404 });
    }
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to update notification"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ updated: true, notificationId: parsed.data.notificationId }));
}
