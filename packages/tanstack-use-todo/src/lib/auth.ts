import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { defineAuth } from "@tanstack-use/permissions/server";
import { db } from "#/lib/db";

export const auth = defineAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [],
});
