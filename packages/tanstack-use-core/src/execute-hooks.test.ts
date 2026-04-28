import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { defineModel } from "./define-model.js";
import { executeCreate, executeUpdate } from "./execute-hooks.js";
import type { DrizzleDb } from "./execute-hooks.js";
import type { BetterAuthSession } from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

type UserRecord = { id: number; name: string };

const mockSession = { user: { id: "u1" } } as unknown as BetterAuthSession;

const mockRecord: UserRecord = { id: 1, name: "Alice" };

/** Build a mock DB that returns the given rows from insert/update */
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

// ---------------------------------------------------------------------------
// executeCreate
// ---------------------------------------------------------------------------

describe("executeCreate()", () => {
  it("inserts the record and returns the persisted row", async () => {
    const model = defineModel(usersTable, {});
    const db = makeDb([mockRecord]);

    const result = await executeCreate(model, mockRecord, mockSession, db);

    expect(db.insert).toHaveBeenCalledWith(usersTable);
    expect(result).toEqual(mockRecord);
  });

  it("calls beforeCreate with { record, session } before inserting", async () => {
    const beforeCreate = vi.fn().mockResolvedValue(undefined);
    const model = defineModel(usersTable, { server: { beforeCreate } });
    const db = makeDb();

    await executeCreate(model, mockRecord, mockSession, db);

    expect(beforeCreate).toHaveBeenCalledWith({ record: mockRecord, session: mockSession });
    // beforeCreate must be called before insert
    const beforeOrder = beforeCreate.mock.invocationCallOrder[0];
    const insertOrder = (db.insert as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(beforeOrder).toBeLessThan(insertOrder);
  });

  it("aborts the operation and propagates the error when beforeCreate throws", async () => {
    const error = new Error("validation failed");
    const beforeCreate = vi.fn().mockRejectedValue(error);
    const model = defineModel(usersTable, { server: { beforeCreate } });
    const db = makeDb();

    await expect(executeCreate(model, mockRecord, mockSession, db)).rejects.toThrow(
      "validation failed",
    );
    // DB insert must NOT have been called
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("calls afterCreate with the persisted record after inserting", async () => {
    const persisted: UserRecord = { id: 99, name: "Alice" };
    const afterCreate = vi.fn().mockResolvedValue(undefined);
    const model = defineModel(usersTable, { server: { afterCreate } });
    const db = makeDb([persisted]);

    await executeCreate(model, mockRecord, mockSession, db);

    expect(afterCreate).toHaveBeenCalledWith({ record: persisted, session: mockSession });
    // afterCreate must be called after insert
    const insertOrder = (db.insert as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const afterOrder = afterCreate.mock.invocationCallOrder[0];
    expect(afterOrder).toBeGreaterThan(insertOrder);
  });

  it("logs the afterCreate error and does NOT roll back the persisted record", async () => {
    const error = new Error("side-effect failed");
    const afterCreate = vi.fn().mockRejectedValue(error);
    const model = defineModel(usersTable, { server: { afterCreate } });
    const db = makeDb([mockRecord]);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await executeCreate(model, mockRecord, mockSession, db);

    // Should resolve (not reject) with the persisted record
    expect(result).toEqual(mockRecord);
    expect(consoleSpy).toHaveBeenCalledWith("afterCreate hook failed:", error);

    consoleSpy.mockRestore();
  });

  it("enforces execution order: beforeCreate → persist → afterCreate", async () => {
    const order: string[] = [];
    const beforeCreate = vi.fn().mockImplementation(async () => { order.push("before"); });
    const afterCreate = vi.fn().mockImplementation(async () => { order.push("after"); });
    const db: DrizzleDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => { order.push("persist"); return [mockRecord]; }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockRecord]) }),
      }),
    };
    const model = defineModel(usersTable, { server: { beforeCreate, afterCreate } });

    await executeCreate(model, mockRecord, mockSession, db);

    expect(order).toEqual(["before", "persist", "after"]);
  });

  it("works correctly when no hooks are defined", async () => {
    const model = defineModel(usersTable, {});
    const db = makeDb([mockRecord]);

    const result = await executeCreate(model, mockRecord, mockSession, db);

    expect(result).toEqual(mockRecord);
    expect(db.insert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// executeUpdate
// ---------------------------------------------------------------------------

describe("executeUpdate()", () => {
  it("updates the record and returns the persisted row", async () => {
    const model = defineModel(usersTable, {});
    const db = makeDb([mockRecord]);

    const result = await executeUpdate(model, mockRecord, mockSession, db);

    expect(db.update).toHaveBeenCalledWith(usersTable);
    expect(result).toEqual(mockRecord);
  });

  it("aborts the operation and propagates the error when beforeUpdate throws", async () => {
    const error = new Error("update blocked");
    const beforeUpdate = vi.fn().mockRejectedValue(error);
    const model = defineModel(usersTable, { server: { beforeUpdate } });
    const db = makeDb();

    await expect(executeUpdate(model, mockRecord, mockSession, db)).rejects.toThrow("update blocked");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("logs the afterUpdate error and does NOT roll back the persisted record", async () => {
    const error = new Error("after update failed");
    const afterUpdate = vi.fn().mockRejectedValue(error);
    const model = defineModel(usersTable, { server: { afterUpdate } });
    const db = makeDb([mockRecord]);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await executeUpdate(model, mockRecord, mockSession, db);

    expect(result).toEqual(mockRecord);
    expect(consoleSpy).toHaveBeenCalledWith("afterUpdate hook failed:", error);

    consoleSpy.mockRestore();
  });

  it("enforces execution order: beforeUpdate → persist → afterUpdate", async () => {
    const order: string[] = [];
    const beforeUpdate = vi.fn().mockImplementation(async () => { order.push("before"); });
    const afterUpdate = vi.fn().mockImplementation(async () => { order.push("after"); });
    const db: DrizzleDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockRecord]) }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => { order.push("persist"); return [mockRecord]; }),
        }),
      }),
    };
    const model = defineModel(usersTable, { server: { beforeUpdate, afterUpdate } });

    await executeUpdate(model, mockRecord, mockSession, db);

    expect(order).toEqual(["before", "persist", "after"]);
  });
});
