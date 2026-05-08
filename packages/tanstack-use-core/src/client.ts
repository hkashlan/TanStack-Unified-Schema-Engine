import { createAuthClient } from "better-auth/react";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ComputedFieldDef, Model, RegisteredApp } from "./types.js";

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
export const appClient: RegisteredApp = {
  _tag: "App",
  models: {},
  auth: createAuthClient(),
} as RegisteredApp;

export function getModel(tableName: string): Model<PgTable, Record<string, ComputedFieldDef<PgTable>>> | undefined {
  return tableName in appClient.models ? (appClient.models[tableName as keyof typeof appClient.models] as Model<PgTable, Record<string, ComputedFieldDef<PgTable>>>) : undefined;
}


