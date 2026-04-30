/**
 * Unit tests for createServerFunctions and useServerFunctions.
 *
 * Requirements: 14.3, 14.4, 14.5, 14.8
 *
 * Strategy: @tanstack/start's createServerFn is a build-time transform that
 * requires the Vite plugin at runtime. In tests we mock the module so that
 * createServerFn returns a simple builder whose .validator().handler() chain
 * exposes the handler function directly — letting us test the business logic
 * (permission checks, hook delegation) without the Start runtime.
 */

import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock @tanstack/start so createServerFn works without the Vite plugin
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-start", () => ({
  createServerFn: (_opts?: unknown) => ({
    validator: (validatorFn: (d: unknown) => unknown) => ({
      handler: (handlerFn: (ctx: { data: unknown }) => unknown) => {
        // Return a callable that mimics the server function interface:
        // calling it with { data } invokes the handler directly.
        const fn = (opts: { data: unknown }) =>
          handlerFn({ data: validatorFn(opts.data) });
        fn.__isServerFn = true;
        return fn;
      },
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mock is set up
// ---------------------------------------------------------------------------

import { createServerFunctions } from "./server-functions.js";
import {
  ServerFunctionsProvider,
  useServerFunctions,
} from "./server-functions-context.js";
import { defineApp, defineModel } from "../../tanstack-use-core/src/index.js";
import { AuthorizationError } from "../../tanstack-use-permissions/src/authorization-error.js";
import type { DrizzleDb } from "../../tanstack-use-core/src/execute-hooks.js";
import type { BetterAuthSession } from "../../tanstack-use-core/src/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
});

const mockSession = { user: { id: "u1" } } as unknown as BetterAuthSession;
const mockRecord = { id: 1, name: "Alice", department: "Engineering" };

/** Build a mock Drizzle DB */
function makeDb(returnedRows: unknown[] = [mockRecord]): DrizzleDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnedRows),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnedRows),
      }),
    }),
  };
}

/** Build an App with configurable permissions and member groups */
function makeApp(
  permissions: {
    create?: string[];
    update?: string[];
    delete?: string[];
    read?: string[];
  } = {},
  memberGroups: string[] = [],
) {
  const model = defineModel(employeeTable, { permissions });
  const auth = {
    api: { getActiveMemberGroups: async () => memberGroups },
  };
  return defineApp({ models: [model], auth });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper — call a server function directly (bypassing the Start runtime)
// ---------------------------------------------------------------------------

type AnyServerFn = (opts: { data: unknown }) => Promise<unknown>;

async function callFn(fn: unknown, data: unknown): Promise<unknown> {
  return (fn as AnyServerFn)({ data });
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe("createServerFunctions — list", () => {
  it("returns records from the database", async () => {
    const app = makeApp();
    const db = makeDb([mockRecord]);
    // Extend db with select mock
    (db as unknown as Record<string, unknown>).select = vi
      .fn()
      .mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([mockRecord]),
          }),
        }),
      });

    const { list } = createServerFunctions(app, db);
    const result = await callFn(list, { tableName: "employee" });

    expect(result).toEqual([mockRecord]);
  });

  it("throws for an unknown table name", async () => {
    const app = makeApp();
    const db = makeDb();
    const { list } = createServerFunctions(app, db);

    await expect(callFn(list, { tableName: "nonexistent" })).rejects.toThrow(
      "Unknown model: nonexistent",
    );
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("createServerFunctions — create", () => {
  it("calls executeCreate and returns the persisted record when permitted", async () => {
    const app = makeApp({ create: ["admin"] }, ["admin"]);
    const db = makeDb([mockRecord]);
    const { create } = createServerFunctions(app, db);

    const result = await callFn(create, {
      tableName: "employee",
      record: { name: "Alice", department: "Engineering" },
      session: mockSession,
    });

    expect(result).toEqual(mockRecord);
    expect(db.insert).toHaveBeenCalledWith(employeeTable);
  });

  it("throws AuthorizationError when the session lacks create permission", async () => {
    const app = makeApp({ create: ["admin"] }, ["viewer"]);
    const db = makeDb();
    const { create } = createServerFunctions(app, db);

    await expect(
      callFn(create, {
        tableName: "employee",
        record: mockRecord,
        session: mockSession,
      }),
    ).rejects.toThrow(AuthorizationError);

    // DB insert must NOT have been called
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("allows create when permissions.create is empty (open access)", async () => {
    const app = makeApp({ create: [] }, []);
    const db = makeDb([mockRecord]);
    const { create } = createServerFunctions(app, db);

    const result = await callFn(create, {
      tableName: "employee",
      record: mockRecord,
      session: mockSession,
    });

    expect(result).toEqual(mockRecord);
  });

  it("invokes beforeCreate hook before persisting", async () => {
    const order: string[] = [];
    const beforeCreate = vi.fn().mockImplementation(async () => {
      order.push("before");
    });
    const model = defineModel(employeeTable, {
      permissions: { create: [] },
      server: { beforeCreate },
    });
    const auth = { api: { getActiveMemberGroups: async () => [] } };
    const app = defineApp({ models: [model], auth });

    const db: DrizzleDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            order.push("persist");
            return [mockRecord];
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRecord]),
        }),
      }),
    };

    const { create } = createServerFunctions(app, db);
    await callFn(create, {
      tableName: "employee",
      record: mockRecord,
      session: mockSession,
    });

    expect(order).toEqual(["before", "persist"]);
  });

  it("propagates beforeCreate error without persisting", async () => {
    const beforeCreate = vi.fn().mockRejectedValue(new Error("blocked"));
    const model = defineModel(employeeTable, {
      permissions: { create: [] },
      server: { beforeCreate },
    });
    const auth = { api: { getActiveMemberGroups: async () => [] } };
    const app = defineApp({ models: [model], auth });
    const db = makeDb();

    const { create } = createServerFunctions(app, db);
    await expect(
      callFn(create, {
        tableName: "employee",
        record: mockRecord,
        session: mockSession,
      }),
    ).rejects.toThrow("blocked");

    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("createServerFunctions — update", () => {
  it("calls executeUpdate and returns the persisted record when permitted", async () => {
    const app = makeApp({ update: ["admin"] }, ["admin"]);
    const db = makeDb([mockRecord]);
    const { update } = createServerFunctions(app, db);

    const result = await callFn(update, {
      tableName: "employee",
      id: 1,
      record: mockRecord,
      session: mockSession,
    });

    expect(result).toEqual(mockRecord);
    expect(db.update).toHaveBeenCalledWith(employeeTable);
  });

  it("throws AuthorizationError when the session lacks update permission", async () => {
    const app = makeApp({ update: ["admin"] }, ["viewer"]);
    const db = makeDb();
    const { update } = createServerFunctions(app, db);

    await expect(
      callFn(update, {
        tableName: "employee",
        id: 1,
        record: mockRecord,
        session: mockSession,
      }),
    ).rejects.toThrow(AuthorizationError);

    expect(db.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("createServerFunctions — remove", () => {
  it("throws AuthorizationError when the session lacks delete permission", async () => {
    const app = makeApp({ delete: ["admin"] }, ["viewer"]);
    const db = makeDb();
    // Extend db with delete mock
    (db as unknown as Record<string, unknown>).delete = vi
      .fn()
      .mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

    const { remove } = createServerFunctions(app, db);

    await expect(
      callFn(remove, {
        tableName: "employee",
        id: 1,
        session: mockSession,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("deletes the record when permitted", async () => {
    const app = makeApp({ delete: [] }, []);
    const db = makeDb();
    const deleteMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    (db as unknown as Record<string, unknown>).delete = deleteMock;

    const { remove } = createServerFunctions(app, db);
    await callFn(remove, {
      tableName: "employee",
      id: 1,
      session: mockSession,
    });

    expect(deleteMock).toHaveBeenCalledWith(employeeTable);
  });
});

// ---------------------------------------------------------------------------
// useServerFunctions
// ---------------------------------------------------------------------------

describe("useServerFunctions()", () => {
  it("throws when called outside <ServerFunctionsProvider>", () => {
    // Suppress React's error boundary console output
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useServerFunctions());
    }).toThrow(
      "useServerFunctions must be used inside <ServerFunctionsProvider>",
    );

    consoleSpy.mockRestore();
  });

  it("returns the fns object when inside <ServerFunctionsProvider>", () => {
    const app = makeApp();
    const db = makeDb();
    const fns = createServerFunctions(app, db);

    const { result } = renderHook(() => useServerFunctions(), {
      wrapper: ({ children }) => (
        <ServerFunctionsProvider fns={fns}>{children}</ServerFunctionsProvider>
      ),
    });

    expect(result.current).toBe(fns);
  });

  it("provides list, get, create, update, remove functions", () => {
    const app = makeApp();
    const db = makeDb();
    const fns = createServerFunctions(app, db);

    const { result } = renderHook(() => useServerFunctions(), {
      wrapper: ({ children }) => (
        <ServerFunctionsProvider fns={fns}>{children}</ServerFunctionsProvider>
      ),
    });

    expect(typeof result.current.list).toBe("function");
    expect(typeof result.current.get).toBe("function");
    expect(typeof result.current.create).toBe("function");
    expect(typeof result.current.update).toBe("function");
    expect(typeof result.current.remove).toBe("function");
  });
});
