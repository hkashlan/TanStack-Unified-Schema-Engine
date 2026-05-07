import type { PgTable } from "drizzle-orm/pg-core";
import type { App, Model } from "./types.js";
import { tanForge } from "./app.js";
export interface AppConfig {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  models: Model<any, any>[];
}




/**
 * Registers all models into a global App registry and stores the result on
 * `tanstack.app` so it can be accessed from anywhere without prop-drilling.
 * Throws if two models share the same table name.
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

  const app: App = { _tag: "App", models };

  // Register on the global tanstack namespace so any part of the framework
  // can reach the app without needing it passed explicitly.
  tanForge.app = app;

  return app;
}
