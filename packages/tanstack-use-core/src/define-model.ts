import type { PgTable } from "drizzle-orm/pg-core";
import type { Model, UIConfig } from "./types.js";

/**
 * Defines a model by combining a Drizzle table with a UI config.
 * The Drizzle table is the schema; UIConfig is a lightweight typed overlay.
 */
export function defineModel<T extends PgTable>(table: T, ui: UIConfig<T>): Model<T> {
  return { _tag: "Model", table, ui };
}
