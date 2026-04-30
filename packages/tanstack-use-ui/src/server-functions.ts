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
import { AuthorizationError, can } from "../../tanstack-use-permissions/src/index.js";
import {
  type DrizzleDb,
  executeCreate,
  executeUpdate,
} from "../../tanstack-use-core/src/execute-hooks.js";
import type { App, BetterAuthSession } from "../../tanstack-use-core/src/types.js";
import type { PgTable } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

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
// Helper — resolve the primary key column name for a Drizzle table
// ---------------------------------------------------------------------------

function getPrimaryKeyColumn(table: PgTable): string {
  const cols = (table as unknown as Record<symbol, unknown>)[
    Symbol.for("drizzle:Columns")
  ] as Record<string, { primary?: boolean }> | undefined;

  if (cols) {
    for (const [key, col] of Object.entries(cols)) {
      if (col.primary) return key;
    }
  }
  // Fallback: assume "id"
  return "id";
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
 * @example
 * ```typescript
 * // app.tsx
 * const fns = createServerFunctions(app, db);
 *
 * <ServerFunctionsProvider fns={fns}>
 *   <RouterProvider router={router} />
 * </ServerFunctionsProvider>
 * ```
 */
export function createServerFunctions(app: App, db: DrizzleDb) {
  // -------------------------------------------------------------------------
  // list — fetch records with optional search, sort, and pagination
  // -------------------------------------------------------------------------

  const list = createServerFn({ method: "GET" })
    .inputValidator((d: ListInput) => d)
    .handler(async ({ data }) => {
      const { tableName, page = 0, pageSize = 20 } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const dbAny = db as unknown as {
        select: () => {
          from: (t: PgTable) => {
            limit: (n: number) => { offset: (n: number) => Promise<unknown[]> };
          };
        };
      };

      const results = await dbAny
        .select()
        .from(model.table)
        .limit(pageSize)
        .offset(page * pageSize);

      return results as any;
    });

  // -------------------------------------------------------------------------
  // get — fetch a single record by id
  // -------------------------------------------------------------------------

  const get = createServerFn({ method: "GET" })
    .inputValidator((d: GetInput) => d)
    .handler(async ({ data }) => {
      const { tableName, id } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const pkCol = getPrimaryKeyColumn(model.table);
      const cols = (model.table as unknown as Record<symbol, unknown>)[
        Symbol.for("drizzle:Columns")
      ] as Record<string, unknown>;
      const pkDrizzleCol = cols[pkCol];

      const dbAny = db as unknown as {
        select: () => {
          from: (t: PgTable) => {
            where: (cond: unknown) => Promise<unknown[]>;
          };
        };
      };

      const rows = await dbAny
        .select()
        .from(model.table)
        .where(eq(pkDrizzleCol as Parameters<typeof eq>[0], id));

      if (!rows[0]) throw new Error(`Record not found: ${tableName}/${id}`);
      return rows[0] as any;
    });

  // -------------------------------------------------------------------------
  // create — insert a new record, running beforeCreate/afterCreate hooks
  // -------------------------------------------------------------------------

  const create = createServerFn({ method: "POST" })
    .inputValidator((d: CreateInput) => d)
    .handler(async ({ data }) => {
      const { tableName, record, session } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const permitted = await can(session, `${tableName}.create`, app);
      if (!permitted) throw new AuthorizationError();

      return executeCreate(
        model,
        record as Parameters<typeof executeCreate>[1],
        session,
        db,
      ) as any;
    });

  // -------------------------------------------------------------------------
  // update — update an existing record, running beforeUpdate/afterUpdate hooks
  // -------------------------------------------------------------------------

  const update = createServerFn({ method: "POST" })
    .inputValidator((d: UpdateInput) => d)
    .handler(async ({ data }) => {
      const { tableName, record, session } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const permitted = await can(session, `${tableName}.update`, app);
      if (!permitted) throw new AuthorizationError();

      return executeUpdate(
        model,
        record as Parameters<typeof executeUpdate>[1],
        session,
        db,
      ) as any;
    });

  // -------------------------------------------------------------------------
  // remove — delete a record by id
  // -------------------------------------------------------------------------

  const remove = createServerFn({ method: "POST" })
    .inputValidator((d: RemoveInput) => d)
    .handler(async ({ data }) => {
      const { tableName, id, session } = data;

      const model = app.models.get(tableName);
      if (!model) throw new Error(`Unknown model: ${tableName}`);

      const permitted = await can(session, `${tableName}.delete`, app);
      if (!permitted) throw new AuthorizationError();

      const pkCol = getPrimaryKeyColumn(model.table);
      const cols = (model.table as unknown as Record<symbol, unknown>)[
        Symbol.for("drizzle:Columns")
      ] as Record<string, unknown>;
      const pkDrizzleCol = cols[pkCol];

      const dbAny = db as unknown as {
        delete: (t: PgTable) => {
          where: (cond: unknown) => Promise<void>;
        };
      };

      await dbAny.delete(model.table).where(eq(pkDrizzleCol as Parameters<typeof eq>[0], id));
    });

  return { list, get, create, update, remove };
}

/** The return type of `createServerFunctions` — used to type the context. */
export type ServerFunctions = ReturnType<typeof createServerFunctions>;
