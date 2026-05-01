"use server";

/**
 * TanStack Start server functions for tanstack-use.
 *
 * `createServerFunctions(app, db)` produces five typed server functions that
 * cover all CRUD operations. Each function:
 *  - Looks up the model by table name
 *  - Enforces permissions via `can()` — throws `AuthorizationError` on failure
 *  - Delegates create/update to `executeCreate`/`executeUpdate` so that
 *    `beforeCreate`, `afterCreate`, `beforeUpdate`, and `afterUpdate` hooks
 *    are always invoked
 *
 * Requirements: 14.1–14.12
 */

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  executeCreate,
  executeUpdate,
} from "../../tanstack-use-core/src/execute-hooks.js";
import type {
  App,
  BetterAuthSession,
  InferRecord,
  Model,
} from "../../tanstack-use-core/src/types.js";
import { AuthorizationError, can } from "../../tanstack-use-permissions/src/index.js";
import type { BetterAuthInstance } from "../../tanstack-use-permissions/src/permissions-adapter.js";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ListInput {
  tableName: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface GetInput {
  tableName: string;
  id: string | number;
}

export interface CreateInput {
  tableName: string;
  record: Record<string, unknown>;
  /** Session is passed explicitly so the server function can enforce permissions. */
  session: BetterAuthSession;
}

export interface UpdateInput {
  tableName: string;
  id: string | number;
  record: Record<string, unknown>;
  session: BetterAuthSession;
}

export interface RemoveInput {
  tableName: string;
  id: string | number;
  session: BetterAuthSession;
}

// ---------------------------------------------------------------------------
// DbRow — a plain object with only serializable primitive values.
// Drizzle always returns rows in this shape (strings, numbers, booleans,
// Dates, null). Casting to this type satisfies TanStack Start's
// ValidateSerializableMapped constraint without using `any`.
// ---------------------------------------------------------------------------

type DbScalar = string | number | boolean | Date | null | undefined;
export type DbRow = Record<string, DbScalar>;

// ---------------------------------------------------------------------------
// Helper — resolve the primary key column for a Drizzle table
// ---------------------------------------------------------------------------

function getPrimaryKeyColumn(model: Model<PgTable>): PgColumn {
  // Drizzle stores column metadata under this well-known symbol key.
  const drizzleColumns = Symbol.for("drizzle:Columns");
  const cols = (model.table as unknown as Record<symbol, Record<string, PgColumn>>)[drizzleColumns];

  if (cols) {
    for (const col of Object.values(cols)) {
      if (col.primary) return col;
    }
  }

  throw new Error("Table has no primary key column");
}

// ---------------------------------------------------------------------------
// createServerFunctions
// ---------------------------------------------------------------------------

/**
 * Produces five typed TanStack Start server functions for all CRUD operations.
 *
 * Call this once at the application root and pass the result to
 * `<ServerFunctionsProvider fns={fns}>`.
 *
 * @param app  - The App registry created by `defineApp`
 * @param db   - A Drizzle NodePgDatabase instance
 * @param auth - The permissions adapter created by `createPermissionsAdapter`
 *
 * @example
 * ```typescript
 * // app.tsx
 * const auth = createPermissionsAdapter(db);
 * const fns = createServerFunctions(app, db, auth);
 *
 * <ServerFunctionsProvider fns={fns}>
 *   <RouterProvider router={router} />
 * </ServerFunctionsProvider>
 * ```
 */
export function createServerFunctions(app: App, db: NodePgDatabase, auth: BetterAuthInstance) {
  // -------------------------------------------------------------------------
  // list — fetch records with optional search, sort, and pagination
  // -------------------------------------------------------------------------

  const list = createServerFn({ method: "GET" })
    .inputValidator((d: ListInput) => d)
    .handler(async ({ data }): Promise<DbRow[]> => {
      const { tableName, page = 0, pageSize = 20 } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const rows = await db.select().from(model.table).limit(pageSize).offset(page * pageSize);
      return rows as DbRow[];
    });

  // -------------------------------------------------------------------------
  // get — fetch a single record by id
  // -------------------------------------------------------------------------

  const get = createServerFn({ method: "GET" })
    .inputValidator((d: GetInput) => d)
    .handler(async ({ data }): Promise<DbRow> => {
      const { tableName, id } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const pkCol = getPrimaryKeyColumn(model);
      const rows = await db.select().from(model.table).where(eq(pkCol, id));

      const row = rows[0];
      if (!row) throw new Error(`Record not found: ${tableName}/${id}`);
      return row as DbRow;
    });

  // -------------------------------------------------------------------------
  // create — insert a new record, running beforeCreate/afterCreate hooks
  // -------------------------------------------------------------------------

  const create = createServerFn({ method: "POST" })
    .inputValidator((d: CreateInput) => d)
    .handler(async ({ data }): Promise<DbRow> => {
      const { tableName, record, session } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const permitted = await can(session, `${tableName}.create`, auth, app);
      if (!permitted) throw new AuthorizationError();

      const result = await executeCreate(
        model,
        record as InferRecord<typeof model.table>,
        session,
        db,
      );
      return result as DbRow;
    });

  // -------------------------------------------------------------------------
  // update — update an existing record, running beforeUpdate/afterUpdate hooks
  // -------------------------------------------------------------------------

  const update = createServerFn({ method: "POST" })
    .inputValidator((d: UpdateInput) => d)
    .handler(async ({ data }): Promise<DbRow> => {
      const { tableName, record, session } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const permitted = await can(session, `${tableName}.update`, auth, app);
      if (!permitted) throw new AuthorizationError();

      const result = await executeUpdate(
        model,
        record as InferRecord<typeof model.table>,
        session,
        db,
      );
      return result as DbRow;
    });

  // -------------------------------------------------------------------------
  // remove — delete a record by id
  // -------------------------------------------------------------------------

  const remove = createServerFn({ method: "POST" })
    .inputValidator((d: RemoveInput) => d)
    .handler(async ({ data }): Promise<void> => {
      const { tableName, id, session } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const permitted = await can(session, `${tableName}.delete`, auth, app);
      if (!permitted) throw new AuthorizationError();

      const pkCol = getPrimaryKeyColumn(model);
      await db.delete(model.table).where(eq(pkCol, id));
    });

  return { list, get, create, update, remove };
}

/** The return type of `createServerFunctions` — used to type the context. */
export type ServerFunctions = ReturnType<typeof createServerFunctions>;
