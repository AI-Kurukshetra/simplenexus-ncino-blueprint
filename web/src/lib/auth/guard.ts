import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getRoleFromUser, type AppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SessionRequired =
  | {
      user: User;
      role: AppRole | null;
      response: null;
    }
  | {
      user: null;
      role: null;
      response: NextResponse;
    };

export async function requireSession(): Promise<SessionRequired> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      role: null,
      response: NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      ),
    };
  }

  return {
    user,
    role: getRoleFromUser(user),
    response: null,
  };
}

export function requireRole(role: AppRole | null, allowed: AppRole[]) {
  if (role && allowed.includes(role)) return null;
  return NextResponse.json(
    { ok: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
    { status: 403 },
  );
}
