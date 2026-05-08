"use server";

/**
 * Shared server functions for all tanstack-use models.
 *
 * These are registered at module level so TanStack Start's compiler can
 * statically replace them with RPC stubs in the client bundle — no pg or
 * drizzle ever reaches the browser.
 *
 * Requirements: 14.1–14.12
 */

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { executeCreate, executeUpdate } from "../../tanstack-use-core/src/execute-hooks.js";
import type { InferRecord, Model } from "../../tanstack-use-core/src/types.js";
import { appServer } from "@tanstack-use/core/server";
import { authMiddleware } from "../../tanstack-use-core/src/middleware.js";
import { AuthorizationError, can } from "@tanstack-use/permissions";
import { getModel } from "@tanstack-use/core/client";

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
}

export interface UpdateInput {
  tableName: string;
  id: string | number;
  record: Record<string, unknown>;
}

export interface RemoveInput {
  tableName: string;
  id: string | number;
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
// Server functions
// ---------------------------------------------------------------------------

export const list = createServerFn({ method: "GET" })
  .inputValidator((d: ListInput) => d)
  .handler(async ({ data }): Promise<DbRow[]> => {

    const db = await appServer.db;
    const { tableName, page = 0, pageSize = 20 } = data;
    const model = getModel(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const rows = await db.select().from(model.table).limit(pageSize).offset(page * pageSize);
    return rows as DbRow[];
  });

export const get = createServerFn({ method: "GET" })
  .inputValidator((d: GetInput) => d)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<DbRow> => {
    const db = await appServer.db;
    const { tableName, id } = data;
    const model = getModel(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const pkCol = getPrimaryKeyColumn(model);
    const rows = await db.select().from(model.table).where(eq(pkCol, id));
    const row = rows[0];
    if (!row) throw new Error(`Record not found: ${tableName}/${id}`);
    return row as DbRow;
  });

export const create = createServerFn({ method: "POST" })
  .inputValidator((d: CreateInput) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }): Promise<DbRow> => {
    const db = await appServer.db;
    const { tableName, record } = data;
    const model = getModel(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const permitted = await can(session, `${tableName}.create`);
    if (!permitted) throw new AuthorizationError();
    const result = await executeCreate(
      model,
      record as InferRecord<typeof model.table>,
      db,
        session,
    );
    return result as DbRow;
  });

export const update = createServerFn({ method: "POST" })
  .inputValidator((d: UpdateInput) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }): Promise<DbRow> => {
    const db = await appServer.db;
    const { tableName, record } = data;
    const model = getModel(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const permitted = await can(session, `${tableName}.update`);
    if (!permitted) throw new AuthorizationError();
    const result = await executeUpdate(
      model,
      record as InferRecord<typeof model.table>,
      db,
      session,
    );
    return result as DbRow;
  });

export const remove = createServerFn({ method: "POST" })
  .inputValidator((d: RemoveInput) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context: { session } }): Promise<void> => {
    const db = await appServer.db;
    const { tableName, id } = data;
    const model = getModel(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const permitted = await can(session, `${tableName}.delete`);
    if (!permitted) throw new AuthorizationError();
    const pkCol = getPrimaryKeyColumn(model);
    await db.delete(model.table).where(eq(pkCol, id));
  });

export const serverFns = { list, get, create, update, remove };
export type ModelServerFns = typeof serverFns;
