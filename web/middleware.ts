import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  canAccessPathForUser,
  getDefaultHomeForUser,
} from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, user } = await updateSession(request);

  const isAuthPage =
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const isProtectedAppPath = pathname.startsWith("/app");

  if (!user && isProtectedAppPath) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL(getDefaultHomeForUser(user), request.url));
  }

  if (user && isProtectedAppPath && !canAccessPathForUser(user, pathname)) {
    return NextResponse.redirect(new URL(getDefaultHomeForUser(user), request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
