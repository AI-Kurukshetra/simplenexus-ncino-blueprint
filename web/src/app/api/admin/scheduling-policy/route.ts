import { NextResponse } from "next/server";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import {
  getSchedulingPolicy,
  schedulingPolicyUpdateSchema,
  updateSchedulingPolicyForAdmin,
} from "@/lib/scheduling/policies";

export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const { error, policy } = await getSchedulingPolicy();
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load scheduling policy"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ policy }));
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const body = await request.json().catch(() => null);
  const parsed = schedulingPolicyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      failure("BAD_REQUEST", "Invalid scheduling policy payload"),
      { status: 400 },
    );
  }

  const { error } = await updateSchedulingPolicyForAdmin({
    adminUser: session.user,
    policy: parsed.data,
  });

  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to update policy"), {
      status: 500,
    });
  }

  return NextResponse.json(success({ policy: parsed.data, updated: true }));
}
