import type { PgTable } from "drizzle-orm/pg-core";
import type { Model, UIConfig } from "./types.js";

/**
 * Defines a model by combining a Drizzle table with a UI config.
 * The Drizzle table is the schema; UIConfig is a lightweight typed overlay.
 *
 * `TComputed` is inferred from the `computedFields` you pass in, so
 * `layout.list` (and `layout.detail`/`layout.create`) will only accept
 * keys that exist in `fields` or `computedFields`.
 */
export function defineModel<
  T extends PgTable,
  TComputed extends Record<string, import("./types.js").ComputedFieldDef<T>>,
>(table: T, ui: UIConfig<T, TComputed>): Model<T, TComputed> {
  return { _tag: "Model", table, ui };
}
