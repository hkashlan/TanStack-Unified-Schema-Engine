import type { PgTable } from "drizzle-orm/pg-core";
import type { ComputedFieldDef, Model, UIConfig } from "./types.js";

/**
 * Defines a model by combining a Drizzle table with a UI config.
 * The Drizzle table is the schema; UIConfig is a lightweight typed overlay.
 *
 * `TComputed` is inferred from the `computedFields` you pass in, so
 * `layout.list` (and `layout.detail`/`layout.create`) will only accept
 * keys that exist in `fields` or `computedFields`.
 *
 * The `as unknown` cast on `ui` is required because TypeScript cannot assign
 * `Partial<Record<LiteralKeys, V>>` to `Partial<Record<string, V>>` — a
 * fundamental structural limitation. `Model.ui` is stored as the base
 * `UIConfig<PgTable>` so that `Model<ConcreteTable>` is assignable to
 * `Model<PgTable>` in `defineApp`. The cast is safe: the runtime value is
 * always the concrete config; only the stored type is widened.
 */
export function defineModel<
  T extends PgTable,
  TComputed extends Record<string, ComputedFieldDef<T>>,
>(table: T, ui: UIConfig<T, TComputed>): Model<T, TComputed> {
  return {
    _tag: "Model",
    table,
    ui: ui as unknown as Model["ui"],
  };
}
