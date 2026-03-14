import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { dispatchAppointmentReminders } from "@/lib/notifications/store";

export async function POST() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const result = await dispatchAppointmentReminders();
  if (result.error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to dispatch reminders"), {
      status: 500,
    });
  }

  return NextResponse.json(
    success({
      runAt: new Date().toISOString(),
      summary: result.summary,
    }),
  );
}
