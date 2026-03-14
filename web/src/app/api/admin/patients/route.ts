import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { failure, success } from "@/lib/api/response";
import { requireRole, requireSession } from "@/lib/auth/guard";
import { listPatients } from "@/lib/patients/store";

const statusSchema = z.object({
  status: z.enum(["ready", "not_ready", "all"]).default("all"),
});

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const roleGuard = requireRole(session.role, ["admin", "super_admin"]);
  if (roleGuard) return roleGuard;

  const parsed = statusSchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? "all",
  });

  if (!parsed.success) {
    return NextResponse.json(failure("BAD_REQUEST", "Invalid patient status filter"), {
      status: 400,
    });
  }

  const { error, patients } = await listPatients();
  if (error) {
    return NextResponse.json(failure("INTERNAL_ERROR", "Unable to load patients"), {
      status: 500,
    });
  }

  const filtered =
    parsed.data.status === "all"
      ? patients
      : patients.filter((patient) =>
          parsed.data.status === "ready"
            ? patient.readyForScheduling
            : !patient.readyForScheduling,
        );

  const sorted = filtered.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(success({ patients: sorted, filter: parsed.data.status }));
}
