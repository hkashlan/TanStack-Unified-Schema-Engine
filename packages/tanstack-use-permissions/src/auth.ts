import { createDb } from "@tanstack-use/core/db";
import { type Auth, betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as authSchema from "./schema/auth-schema";

const db = createDb(process.env.DATABASE_URL!);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema 
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [organization(), admin(), tanstackStartCookies()],
});