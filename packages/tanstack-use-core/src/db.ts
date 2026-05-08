/**
 * Framework-owned database factory.
 *
 * `createDb(databaseUrl)` returns a Drizzle NodePgDatabase instance.
 * The developer passes their env variable value — the framework never reads
 * `process.env` directly.
 *
 * A module-level singleton is kept per connection string so repeated calls
 * with the same URL reuse the same pool.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

const instances = new Map<string, NodePgDatabase>();

/**
 * Returns a Drizzle database instance for the given connection string.
 * Reuses an existing instance if one was already created for the same URL.
 *
 * @param databaseUrl - A PostgreSQL connection string, e.g. `process.env.DATABASE_URL`
 *
 * @example
 * ```ts
 * // server-functions.ts  ("use server")
 * import { createServerFunctions } from "@tanstack-use/ui/server";
 * import { todoApp } from "./todo-app.js";
 *
 * export const { list, get, create, update, remove } =
 *   createServerFunctions(todoApp, process.env.DATABASE_URL!);
 * ```
 */
export function createDb(databaseUrl: string): NodePgDatabase {
  const existing = instances.get(databaseUrl);
  if (existing) return existing;

  const db = drizzle({ connection: databaseUrl });
  instances.set(databaseUrl, db);
  return db;
}
