import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { appClient } from "./client.js";
import { createAuth } from "./auth.js";
export * from "./schema/schema.js";

/**
 * Server-only singleton.
 *
 * Extends `appClient` with a single lazily-initialised Drizzle `db` instance.
 * Import this **only** in server-side files (server functions, auth setup,
 * seed scripts). Never import it in client components or shared UI code.
 *
 * The `db` getter uses a dynamic `import()` so Vite's static analyser never
 * sees `drizzle-orm/node-postgres` or `pg` in the client bundle — the module
 * boundary enforces this structurally rather than relying on `optimizeDeps`
 * exclusions alone.
 *
 * One instance, one pool. Both `server.functions.ts` and `auth.ts` share the
 * same `db` object, so there is exactly one `pg.Pool` in the process.
 *
 * @example
 * ```ts
 * import { appServer } from "@tanstack-use/core/server";
 *
 * // Inside an async server function:
 * const db = await appServer.getDb();
 * const rows = await db.select().from(myTable);
 * ```
 */

const db = drizzle({ connection: process.env["DATABASE_URL"]! });
const auth = createAuth(db);

interface AppServer {
  client: typeof appClient;
  db: NodePgDatabase;
  auth: typeof auth;
  hasPermission: typeof auth.api.hasPermission;
}

export const appServer: AppServer = {
  client: appClient,
  db,
  /** Returns the Drizzle db instance (kept for API compatibility). */
  auth,
  hasPermission: auth.api.hasPermission
};

export type Session = typeof appServer.auth.$Infer.Session;

// export const appServer: typeof _appServer & { models: App["models"] } =
//   Object.defineProperty(_appServer, "models", {
//     get() {
//       return appClient.models;
//     },
//     enumerable: true,
//   }) as typeof _appServer & { models: App["models"] };