import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env/public";

const serverOnlyEnvSchema = z.object({
  supabaseServiceRoleKey: z.string().min(1),
});

const serverOnlyEnv = serverOnlyEnvSchema.parse({
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

export const serverEnv = {
  ...publicEnv,
  ...serverOnlyEnv,
};
