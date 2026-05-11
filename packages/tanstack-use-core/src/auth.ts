import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth-schema.js";
import { buildAc } from "./permission-generator.js";
import { appClient } from "./client.js";

// TS2742 ("cannot be named without a reference to .pnpm/zod/...") is a known
// better-auth + pnpm monorepo issue: the admin() plugin's $Infer metadata
// references zod/v4/core types via a pnpm store path that TypeScript can't
// emit in declaration files.
//
// The suppression below is intentional and scoped to the single export that
// triggers it. The inferred type is correct at runtime; only the declaration
// emit path is unstable.
//
// See: https://github.com/better-auth/better-auth/issues/4654

function buildAuthConfig(db: NodePgDatabase) {
  return {
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
      tanstackStartCookies(),
    ],
  };
}

// @ts-ignore TS2742 — see comment above
export const createAuth = (db: NodePgDatabase) => betterAuth(buildAuthConfig(db));

/**
 * Stub auth instance used exclusively by the `better-auth` CLI (`auth generate`).
 * The CLI requires a named `auth` export to introspect plugins and generate
 * the schema — it never actually connects to the database during generation.
 *
 * Do NOT use this instance at runtime; use `createAuth(db)` instead.
 */
// @ts-ignore TS2742 — see comment above
export const auth = betterAuth({
  ...buildAuthConfig({} as NodePgDatabase),
  database: drizzleAdapter({} as NodePgDatabase, {
    provider: "pg",
    schema: authSchema,
  }),
});
