/**
 * Unit tests for buildAITools().
 *
 * Requirements: 13.2, 13.8, 10.12
 *
 * Strategy: We build a real App via defineModel/defineApp, supply a mock
 * AIServerFunctions object, and assert which tool names are present in the
 * returned record. We also verify that each tool's execute function delegates
 * to the correct server function.
 */

import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { buildAITools } from "./build-ai-tools.js";
import { defineApp, defineModel } from "@tanstack-use/core";
import type { AIServerFunctions } from "./build-ai-tools.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
});

const projectTable = pgTable("project", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});

const mockRecord = { id: 1, name: "Alice", department: "Engineering" };

/** Build a mock AIServerFunctions object with vi.fn() stubs. */
function makeServerFns(): AIServerFunctions {
  return {
    list: vi.fn().mockResolvedValue([mockRecord]),
    create: vi.fn().mockResolvedValue(mockRecord),
    update: vi.fn().mockResolvedValue(mockRecord),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

/** Build an App with configurable permissions and member groups. */
function makeApp(
  permissions: {
    read?: string[];
    create?: string[];
    update?: string[];
    delete?: string[];
  } = {},
  memberGroups: string[] = [],
) {
  const model = defineModel(employeeTable, { permissions });
  const auth = {
    api: { getActiveMemberGroups: async () => memberGroups },
  };
  return defineApp({ models: [model], auth });
}

// ---------------------------------------------------------------------------
// Tool presence tests
// ---------------------------------------------------------------------------

describe("buildAITools() — tool presence", () => {
  it("generates all four tools when permissions are empty (open access)", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    expect(Object.keys(tools)).toContain("listEmployee");
    expect(Object.keys(tools)).toContain("createEmployee");
    expect(Object.keys(tools)).toContain("updateEmployee");
    expect(Object.keys(tools)).toContain("deleteEmployee");
  });

  it("generates a createEmployee tool when session has create permission", async () => {
    const app = makeApp({ create: ["admin"] }, ["admin"]);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    expect(Object.keys(tools)).toContain("createEmployee");
  });

  it("does NOT generate a createEmployee tool when session lacks create permission", async () => {
    const app = makeApp({ create: ["admin"] }, ["viewer"]);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    expect(Object.keys(tools)).not.toContain("createEmployee");
  });

  it("generates list tool but not create/update/delete when only read is permitted", async () => {
    const app = makeApp(
      { read: [], create: ["admin"], update: ["admin"], delete: ["admin"] },
      ["viewer"],
    );
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    expect(Object.keys(tools)).toContain("listEmployee");
    expect(Object.keys(tools)).not.toContain("createEmployee");
    expect(Object.keys(tools)).not.toContain("updateEmployee");
    expect(Object.keys(tools)).not.toContain("deleteEmployee");
  });

  it("generates no tools when all operations are restricted and session has no groups", async () => {
    const app = makeApp(
      { read: ["admin"], create: ["admin"], update: ["admin"], delete: ["admin"] },
      [],
    );
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    expect(Object.keys(tools)).toHaveLength(0);
  });

  it("generates tools for multiple models independently", async () => {
    const employeeModel = defineModel(employeeTable, {
      permissions: { create: ["admin"] },
    });
    const projectModel = defineModel(projectTable, {
      permissions: {}, // open access
    });
    const auth = {
      api: { getActiveMemberGroups: async () => ["admin"] },
    };
    const app = defineApp({ models: [employeeModel, projectModel], auth });
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    // Employee: all permitted (admin has create, and read/update/delete are open)
    expect(Object.keys(tools)).toContain("listEmployee");
    expect(Object.keys(tools)).toContain("createEmployee");
    // Project: all open
    expect(Object.keys(tools)).toContain("listProject");
    expect(Object.keys(tools)).toContain("createProject");
    expect(Object.keys(tools)).toContain("updateProject");
    expect(Object.keys(tools)).toContain("deleteProject");
  });

  it("returns an empty object for an app with no models", async () => {
    const auth = { api: { getActiveMemberGroups: async () => [] } };
    const app = defineApp({ models: [], auth });
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    expect(Object.keys(tools)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tool executor tests
// ---------------------------------------------------------------------------

describe("buildAITools() — tool executors", () => {
  it("list tool executor calls serverFns.list with the correct tableName", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);
    const listTool = tools["listEmployee"];

    expect(listTool).toBeDefined();
    // The tool is a ServerTool — call its execute function directly
    const result = await listTool.execute?.({});

    expect(serverFns.list).toHaveBeenCalledWith({ tableName: "employee", search: undefined });
    expect(result).toEqual([mockRecord]);
  });

  it("list tool executor passes search term to serverFns.list", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);
    await tools["listEmployee"].execute?.({ search: "Alice" });

    expect(serverFns.list).toHaveBeenCalledWith({ tableName: "employee", search: "Alice" });
  });

  it("create tool executor calls serverFns.create with tableName and record", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);
    const record = { name: "Bob", department: "Design" };
    const result = await tools["createEmployee"].execute?.({ record });

    expect(serverFns.create).toHaveBeenCalledWith({ tableName: "employee", record });
    expect(result).toEqual(mockRecord);
  });

  it("update tool executor calls serverFns.update with tableName, id, and record", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);
    const record = { name: "Charlie" };
    await tools["updateEmployee"].execute?.({ id: 42, record });

    expect(serverFns.update).toHaveBeenCalledWith({
      tableName: "employee",
      id: 42,
      record,
    });
  });

  it("delete tool executor calls serverFns.remove with tableName and id", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);
    const result = await tools["deleteEmployee"].execute?.({ id: 7 });

    expect(serverFns.remove).toHaveBeenCalledWith({ tableName: "employee", id: 7 });
    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// Tool metadata tests
// ---------------------------------------------------------------------------

describe("buildAITools() — tool metadata", () => {
  it("each tool has a name matching its key in the returned record", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    for (const [key, tool] of Object.entries(tools)) {
      expect(tool.name).toBe(key);
    }
  });

  it("each tool has a non-empty description", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    for (const tool of Object.values(tools)) {
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("each tool has an inputSchema", async () => {
    const app = makeApp({}, []);
    const serverFns = makeServerFns();

    const tools = await buildAITools(app, {}, serverFns);

    for (const tool of Object.values(tools)) {
      expect(tool.inputSchema).toBeDefined();
    }
  });
});
