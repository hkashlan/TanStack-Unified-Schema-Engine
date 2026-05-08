import type { PgTable } from "drizzle-orm/pg-core";
import type { App, Model } from "./types.js";
import { appClient } from "./client.js";

export interface AppConfig {
  // biome-ignore lint/suspicious/noExplicitAny: models are heterogeneous by design
  models: Model<any, any>[];
}

/**
 * Registers all models into the global `appClient` registry.
 *
 * Call this once at app startup (e.g. in `src/lib/app.ts`). After this call,
 * `appClient.models` is populated and both client components and server
 * functions can look up models by table name.
 *
 * Throws if two models share the same Drizzle table name.
 */
export function defineApp(config: AppConfig): App {
  const models = new Map<string, Model<PgTable>>();

  for (const model of config.models) {
    const name = (model.table as unknown as Record<symbol, unknown>)[
      Symbol.for("drizzle:Name")
    ] as string;
    if (models.has(name)) {
      throw new Error(`Duplicate model: ${name}`);
    }
    models.set(name, model);
  }

  // Mutate the shared singleton so all importers see the updated registry.
  appClient.models = models;

  return appClient;
}
