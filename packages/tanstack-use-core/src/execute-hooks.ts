import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Session } from "./server.js";
import type { InferRecord, Model } from "./types.js";

/**
 * Executes the create lifecycle for a model:
 *   1. beforeCreate hook (if defined) — throws abort the operation
 *   2. DB insert
 *   3. afterCreate hook (if defined) — errors are logged, not propagated
 */
export async function executeCreate<T extends PgTable>(
  model: Model<T>,
  record: InferRecord<T>,
  db: NodePgDatabase,
  session: Session,
): Promise<InferRecord<T>> {
  const hooks = model.ui.server;

  if (hooks?.beforeCreate) {
    await hooks.beforeCreate({ record, session: session });
  }

  const result = await db.insert(model.table).values(record).returning();
  const rows = Array.isArray(result) ? result : [];
  const persisted = rows[0] as InferRecord<T>;

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
  db: NodePgDatabase,
  session: Session,
): Promise<InferRecord<T>> {
  const hooks = model.ui.server;

  if (hooks?.beforeUpdate) {
    await hooks.beforeUpdate({ record, session });
  }

  const result = await db.update(model.table).set(record).returning();
  const rows = Array.isArray(result) ? result : [];
  const persisted = rows[0] as InferRecord<T>;

  if (hooks?.afterUpdate) {
    try {
      await hooks.afterUpdate({ record: persisted, session });
    } catch (err) {
      console.error("afterUpdate hook failed:", err);
    }
  }

  return persisted;
}
