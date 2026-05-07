"use server";

/**
 * Todo-app server functions.
 *
 * `createServerFn` calls MUST live in a "use server" file so TanStack Start's
 * compiler can replace them with RPC stubs in the client bundle.
 * `todoApp` (and therefore `pg` / `drizzle-orm/node-postgres`) is imported
 * here — server-side only — and never reaches the browser.
 */

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { executeCreate, executeUpdate } from "@tanstack-use/core";
import { AuthorizationError, can } from "@tanstack-use/permissions";
import { createPermissionsAdapter } from "@tanstack-use/permissions/server";
import { createDb } from "@tanstack-use/core/db";
import { todoApp } from "./todo-app.js";
import type {
  BetterAuthSession,
  InferRecord,
  Model,
} from "@tanstack-use/core";
import type {
  CreateInput,
  DbRow,
  GetInput,
  ListInput,
  RemoveInput,
  UpdateInput,
} from "@tanstack-use/ui/server";

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

const databaseUrl = process.env["DATABASE_URL"]!;

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const list = createServerFn({ method: "GET" })
  .inputValidator((d: ListInput) => d)
  .handler(async ({ data }): Promise<DbRow[]> => {
    const db = createDb(databaseUrl);
    const { tableName, page = 0, pageSize = 20 } = data;
    const model = todoApp.models.get(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const rows = await db.select().from(model.table).limit(pageSize).offset(page * pageSize);
    return rows as DbRow[];
  });

export const get = createServerFn({ method: "GET" })
  .inputValidator((d: GetInput) => d)
  .handler(async ({ data }): Promise<DbRow> => {
    const db = createDb(databaseUrl);
    const { tableName, id } = data;
    const model = todoApp.models.get(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const pkCol = getPrimaryKeyColumn(model);
    const rows = await db.select().from(model.table).where(eq(pkCol, id));
    const row = rows[0];
    if (!row) throw new Error(`Record not found: ${tableName}/${id}`);
    return row as DbRow;
  });

export const create = createServerFn({ method: "POST" })
  .inputValidator((d: CreateInput) => d)
  .handler(async ({ data }): Promise<DbRow> => {
    const db = createDb(databaseUrl);
    const auth = createPermissionsAdapter(db);
    const { tableName, record, session } = data;
    const model = todoApp.models.get(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const permitted = await can(session, `${tableName}.create`, auth, todoApp);
    if (!permitted) throw new AuthorizationError();
    const result = await executeCreate(
      model,
      record as InferRecord<typeof model.table>,
      session as BetterAuthSession,
      db,
    );
    return result as DbRow;
  });

export const update = createServerFn({ method: "POST" })
  .inputValidator((d: UpdateInput) => d)
  .handler(async ({ data }): Promise<DbRow> => {
    const db = createDb(databaseUrl);
    const auth = createPermissionsAdapter(db);
    const { tableName, record, session } = data;
    const model = todoApp.models.get(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const permitted = await can(session, `${tableName}.update`, auth, todoApp);
    if (!permitted) throw new AuthorizationError();
    const result = await executeUpdate(
      model,
      record as InferRecord<typeof model.table>,
      session as BetterAuthSession,
      db,
    );
    return result as DbRow;
  });

export const remove = createServerFn({ method: "POST" })
  .inputValidator((d: RemoveInput) => d)
  .handler(async ({ data }): Promise<void> => {
    const db = createDb(databaseUrl);
    const auth = createPermissionsAdapter(db);
    const { tableName, id, session } = data;
    const model = todoApp.models.get(tableName);
    if (!model) throw new Error(`Unknown model: ${tableName}`);
    const permitted = await can(session, `${tableName}.delete`, auth, todoApp);
    if (!permitted) throw new AuthorizationError();
    const pkCol = getPrimaryKeyColumn(model);
    await db.delete(model.table).where(eq(pkCol, id));
  });

export const todoServerFns = { list, get, create, update, remove };
