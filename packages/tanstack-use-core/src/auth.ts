import { betterAuth, BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth-schema.js";
import { buildAc } from "./permission-generator.js";
import { appClient } from "./client.js";

// 1. Create a helper to define the config.
// We use a function to avoid the 'readonly' array issue with plugins.
const getAuthConfig = (db: NodePgDatabase) => ({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      ac: buildAc(appClient.models),
      dynamicAccessControl: { enabled: true },
    }),
    admin(),
    tanstackStartCookies(),
  ] as any,
} satisfies BetterAuthOptions);

// 2. Define the AuthInstance type using ReturnType and the type of your config
export type AuthInstance = ReturnType<typeof betterAuth<ReturnType<typeof getAuthConfig>>>;

// 3. Annotate the function return type explicitly
export const createAuth = (db: NodePgDatabase): AuthInstance => {
  return betterAuth(getAuthConfig(db));
};