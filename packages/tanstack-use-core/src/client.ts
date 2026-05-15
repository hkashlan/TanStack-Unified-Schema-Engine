import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { PgTable } from "drizzle-orm/pg-core";
import type { App, ComputedFieldDef, Model, RegisteredApp } from "./types.js";

/**
 * Client-safe singleton.
 *
 * Holds the model registry populated by `defineApp()` and the Better Auth
 * client instance. Safe to import in browser and React contexts.
 *
 * To get full type safety with autocomplete for `appClient.models.yourModel`,
 * augment the `Register` interface after calling `defineApp`:
 *
 * @example
 * ```ts
 * // src/router.tsx or src/lib/app.ts
 * import { defineApp } from "@tanstack-use/core";
 * import { todoModel } from "./lib/model.js";
 *
 * export const app = defineApp({ models: { todo: todoModel } });
 *
 * declare module "@tanstack-use/core" {
 *   interface Register {
 *     app: typeof app;
 *   }
 * }
 *
 * // Now everywhere:
 * import { appClient } from "@tanstack-use/core";
 * appClient.models.todo  // ✓ fully typed
 * const { data: session } = appClient.auth.useSession();
 * ```
 */

// TS2742: better-auth's plugin types reference internal .mjs paths that
// TypeScript can't emit in declaration files. We create the client as `any`
// internally, then cast the export to the inferred type so consumers get
// full autocomplete while TypeScript has a stable type to emit.
// See: https://github.com/better-auth/better-auth/issues/4654

const _authClientInstance = createAuthClient({
  plugins: [
    organizationClient({
      dynamicAccessControl: { enabled: true },
    }),
  ],
});

// Typed reference used only for `typeof` — never called at runtime.
declare const _authClientTyped: ReturnType<
  typeof createAuthClient<{
    plugins: [ReturnType<typeof organizationClient<{ dynamicAccessControl: { enabled: true } }>>];
  }>
>;

export const authClient = _authClientInstance as typeof _authClientTyped;

const _appClient: App = {
  _tag: "App",
  models: {},
  auth: authClient,
};

export const appClient = _appClient as RegisteredApp & { auth: typeof authClient };

export function getModel(
  tableName: keyof RegisteredApp["models"],
): Model<PgTable, Record<string, ComputedFieldDef<PgTable>>> | undefined {
  return tableName in appClient.models
    ? (appClient.models[tableName] as Model<PgTable, Record<string, ComputedFieldDef<PgTable>>>)
    : undefined;
}

export type SessionClient = typeof authClient.$Infer.Session;
