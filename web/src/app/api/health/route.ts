import { NextResponse } from "next/server";
import { z } from "zod";

import { success } from "@/lib/api/response";

const healthQuerySchema = z.object({
  scope: z.enum(["public"]).default("public"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = healthQuerySchema.safeParse({
    scope: searchParams.get("scope") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid query params",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    success({
      status: "healthy",
      timestamp: new Date().toISOString(),
      scope: parsed.data.scope,
    }),
  );
}
