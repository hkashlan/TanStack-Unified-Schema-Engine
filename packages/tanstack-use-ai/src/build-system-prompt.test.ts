import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./build-system-prompt.js";
import type { App } from "@tanstack-use/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAuth = { api: { getActiveMemberGroups: async () => [] } };

function makeApp(models: Map<string, { table: unknown; ui: unknown }>): App {
  return {
    _tag: "App",
    models: models as App["models"],
    auth: mockAuth,
  };
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

const projectTable = pgTable("project", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildSystemPrompt()", () => {
  it("mentions every registered model's table name", () => {
    const app = makeApp(
      new Map([
        ["employee", { table: employeeTable, ui: {} }],
        ["project", { table: projectTable, ui: {} }],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("employee");
    expect(prompt).toContain("project");
  });

  it("lists field names for each model", () => {
    const app = makeApp(
      new Map([["employee", { table: employeeTable, ui: {} }]]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("id");
    expect(prompt).toContain("name");
    expect(prompt).toContain("email");
  });

  it("includes 'Can list' when ui.layout.list is defined", () => {
    const app = makeApp(
      new Map([
        [
          "employee",
          {
            table: employeeTable,
            ui: { layout: { list: ["id", "name"] } },
          },
        ],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("Can list employee");
  });

  it("includes 'Can view' when ui.layout.detail is defined", () => {
    const app = makeApp(
      new Map([
        [
          "employee",
          {
            table: employeeTable,
            ui: {
              layout: {
                detail: [{ label: "Info", rows: [["id", "name"]] }],
              },
            },
          },
        ],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("Can view employee details");
  });

  it("includes 'Can create' when ui.layout.create is defined", () => {
    const app = makeApp(
      new Map([
        [
          "employee",
          {
            table: employeeTable,
            ui: { layout: { create: ["name", "email"] } },
          },
        ],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("Can create employee");
  });

  it("describes a model with all layout sections defined", () => {
    const app = makeApp(
      new Map([
        [
          "employee",
          {
            table: employeeTable,
            ui: {
              layout: {
                list: ["id", "name"],
                detail: [{ label: "Info", rows: [["id", "name"]] }],
                create: ["name", "email"],
              },
            },
          },
        ],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("Can list employee");
    expect(prompt).toContain("Can view employee details");
    expect(prompt).toContain("Can create employee");
  });

  it("describes a model with no layout sections as having no available pages", () => {
    const app = makeApp(
      new Map([["employee", { table: employeeTable, ui: {} }]]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("No pages available for employee");
    expect(prompt).not.toContain("Can list");
    expect(prompt).not.toContain("Can view");
    expect(prompt).not.toContain("Can create");
  });

  it("describes a model with an empty layout object as having no available pages", () => {
    const app = makeApp(
      new Map([["employee", { table: employeeTable, ui: { layout: {} } }]]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("No pages available for employee");
  });

  it("does not mention absent layout sections", () => {
    // Only list is defined — detail and create should not appear
    const app = makeApp(
      new Map([
        [
          "employee",
          {
            table: employeeTable,
            ui: { layout: { list: ["id", "name"] } },
          },
        ],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("Can list employee");
    expect(prompt).not.toContain("Can view employee details");
    expect(prompt).not.toContain("Can create employee");
  });

  it("returns a non-empty string for an empty app registry", () => {
    const app = makeApp(new Map());

    const prompt = buildSystemPrompt(app);

    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("covers multiple models with different layout configurations", () => {
    const app = makeApp(
      new Map([
        [
          "employee",
          {
            table: employeeTable,
            ui: { layout: { list: ["id", "name"], create: ["name", "email"] } },
          },
        ],
        [
          "project",
          {
            table: projectTable,
            ui: {},
          },
        ],
      ]),
    );

    const prompt = buildSystemPrompt(app);

    expect(prompt).toContain("Can list employee");
    expect(prompt).toContain("Can create employee");
    expect(prompt).not.toContain("Can view employee details");
    expect(prompt).toContain("No pages available for project");
  });
});
