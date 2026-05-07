import type { App } from "./types.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface TanForge {
  app: App;
  db: NodePgDatabase;
}

/**
 * Global `tanForge` singleton — the single entry point for everything the
 * framework exposes at runtime.
 *
 * `tanForge.db` is lazily initialised on first access. The dynamic import of
 * `drizzle-orm/node-postgres` (which pulls in `pg`) is deferred inside a
 * getter so Vite's static analyser never sees it in the client bundle.
 *
 * After calling `defineApp()`, the registered app is available as:
 *   `tanForge.app`
 *
 * @example
 * ```ts
 * import { defineApp } from "@tanstack-use/core";
 * import { tanForge } from "@tanstack-use/core/app";
 *
 * defineApp({ models: [todoModel] });
 *
 * // anywhere in your server code (inside an async server function):
 * const rows = await (await tanForge.getDb()).select().from(myTable);
 * ```
 */

let _db: NodePgDatabase | undefined;

/**
 * Returns the Drizzle DB instance, initialising it on first call.
 * Must be awaited — the first call performs a dynamic import of
 * `drizzle-orm/node-postgres` to keep `pg` out of the client bundle.
 */
async function getDb(): Promise<NodePgDatabase> {
  if (_db) return _db;
  // Dynamic import keeps drizzle-orm/node-postgres (and pg) out of the static
  // module graph so Vite never analyses them for the client bundle.
  const { drizzle } = await import("drizzle-orm/node-postgres");
  _db = drizzle({ connection: process.env["DATABASE_URL"]! });
  return _db;
}

export const tanForge = {
  app: { _tag: "App", models: new Map() } as App,
  /** Async accessor — always await this in server functions. */
  getDb,
} satisfies { app: App; getDb: () => Promise<NodePgDatabase> };
