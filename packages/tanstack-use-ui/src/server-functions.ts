"use server";

/**
 * Per-model server function factory.
 *
 * `createModelServerFns(tableName, databaseUrl)` is called at **module level**
 * inside each generated page file. TanStack Start's compiler sees the
 * `createServerFn` calls statically and replaces them with RPC stubs in the
 * client bundle — no pg or drizzle ever reaches the browser.
 *
 * Requirements: 14.1–14.12
 */

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
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
import { createPermissionsAdapter } from "../../tanstack-use-permissions/src/permissions-adapter.js";
import { createDb } from "../../tanstack-use-core/src/db.js";

// ---------------------------------------------------------------------------
// Input / output types
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

type DbScalar = string | number | boolean | Date | null | undefined;
export type DbRow = Record<string, DbScalar>;

// ---------------------------------------------------------------------------
// Helper — resolve the primary key column for a Drizzle table
// ---------------------------------------------------------------------------

function getPrimaryKeyColumn(model: Model<PgTable>): PgColumn {
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
// createModelServerFns
// ---------------------------------------------------------------------------

/**
 * Creates five TanStack Start server functions scoped to a single model.
 *
 * Call this at **module level** in each page file so TanStack Start's compiler
 * can statically replace the calls with RPC stubs:
 *
 * ```ts
 * // ListPage.tsx (module level, outside the component)
 * const { list } = createModelServerFns(tableName, process.env.DATABASE_URL!);
 * ```
 *
 * @param app         - The App registry (for permission checks)
 * @param databaseUrl - PostgreSQL connection string
 */
export function createModelServerFns(app: App, databaseUrl: string) {
  const db = createDb(databaseUrl);
  const auth = createPermissionsAdapter(db);

  const list = createServerFn({ method: "GET" })
    .inputValidator((d: ListInput) => d)
    .handler(async ({ data }): Promise<DbRow[]> => {
      const { tableName, page = 0, pageSize = 20 } = data;
      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);
      const rows = await db.select().from(model.table).limit(pageSize).offset(page * pageSize);
      return rows as DbRow[];
    });

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

export type ModelServerFns = ReturnType<typeof createModelServerFns>;
