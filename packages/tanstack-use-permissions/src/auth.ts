import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth-schema";

// auth.ts is server-only — it's safe to import drizzle-orm/node-postgres directly here.
const db = drizzle({ connection: process.env["DATABASE_URL"]! });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [organization(), admin(), tanstackStartCookies()],
});