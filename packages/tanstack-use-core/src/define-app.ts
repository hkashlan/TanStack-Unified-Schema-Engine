import type { App, Model } from "./types.js";

export interface AppConfig {
  models: Model<any>[];
  auth: any; // pre-configured Better Auth instance with organization plugin
}

/**
 * Registers all models and a Better Auth instance into a global App registry.
 * Throws if two models share the same table name.
 */
export function defineApp(config: AppConfig): App {
  const models = new Map<string, Model<any>>();

  for (const model of config.models) {
    const name = model.table[Symbol.for("drizzle:Name") as symbol] as string;
    if (models.has(name)) {
      throw new Error(`Duplicate model: ${name}`);
    }
    models.set(name, model);
  }

  return { _tag: "App", models, auth: config.auth };
}
