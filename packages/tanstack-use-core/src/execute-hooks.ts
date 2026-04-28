import type { PgTable } from "drizzle-orm/pg-core";
import type { BetterAuthSession, InferRecord, Model } from "./types.js";

/**
 * Minimal interface for a Drizzle database instance.
 * Only the insert operation is required by this module.
 */
export interface DrizzleDb {
  insert: (table: PgTable) => {
    values: (record: unknown) => {
      returning: () => Promise<unknown[]>;
    };
  };
  update: (table: PgTable) => {
    set: (record: unknown) => {
      returning: () => Promise<unknown[]>;
    };
  };
}

/**
 * Executes the create lifecycle for a model:
 *   1. beforeCreate hook (if defined) — throws abort the operation
 *   2. DB insert
 *   3. afterCreate hook (if defined) — errors are logged, not propagated
 */
export async function executeCreate<T extends PgTable>(
  model: Model<T>,
  record: InferRecord<T>,
  session: BetterAuthSession,
  db: DrizzleDb,
): Promise<InferRecord<T>> {
  const hooks = model.ui.server;

  // Step 1: beforeCreate — any throw aborts the operation
  if (hooks?.beforeCreate) {
    await hooks.beforeCreate({ record, session });
  }

  // Step 2: persist
  const rows = await db.insert(model.table).values(record).returning();
  const persisted = rows[0] as InferRecord<T>;

  // Step 3: afterCreate — errors are caught and logged, record is NOT rolled back
  if (hooks?.afterCreate) {
    try {
      await hooks.afterCreate({ record: persisted, session });
    } catch (err) {
      console.error("afterCreate hook failed:", err);
    }
  }

  return persisted;
}

/**
 * Executes the update lifecycle for a model:
 *   1. beforeUpdate hook (if defined) — throws abort the operation
 *   2. DB update
 *   3. afterUpdate hook (if defined) — errors are logged, not propagated
 */
export async function executeUpdate<T extends PgTable>(
  model: Model<T>,
  record: InferRecord<T>,
  session: BetterAuthSession,
  db: DrizzleDb,
): Promise<InferRecord<T>> {
  const hooks = model.ui.server;

  // Step 1: beforeUpdate — any throw aborts the operation
  if (hooks?.beforeUpdate) {
    await hooks.beforeUpdate({ record, session });
  }

  // Step 2: persist
  const rows = await db.update(model.table).set(record).returning();
  const persisted = rows[0] as InferRecord<T>;

  // Step 3: afterUpdate — errors are caught and logged, record is NOT rolled back
  if (hooks?.afterUpdate) {
    try {
      await hooks.afterUpdate({ record: persisted, session });
    } catch (err) {
      console.error("afterUpdate hook failed:", err);
    }
  }

  return persisted;
}
