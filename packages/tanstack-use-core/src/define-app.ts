import type { PgTable } from "drizzle-orm/pg-core";
import type { App, Model } from "./types.js";

export interface AppConfig {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  models: Model<any, any>[];
}

/**
 * Registers all models into a global App registry.
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

  return { _tag: "App", models };
}
