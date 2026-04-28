import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { defineModel } from "./define-model.js";
import type { UIConfig } from "./types.js";

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

describe("defineModel()", () => {
  it("returns a Model with _tag: 'Model'", () => {
    const ui: UIConfig<typeof usersTable> = {};
    const model = defineModel(usersTable, ui);
    expect(model._tag).toBe("Model");
  });

  it("stores the exact table reference passed in", () => {
    const ui: UIConfig<typeof usersTable> = {};
    const model = defineModel(usersTable, ui);
    expect(model.table).toBe(usersTable);
  });

  it("stores the exact ui config reference passed in", () => {
    const ui: UIConfig<typeof usersTable> = {
      fields: { name: { label: "Full Name" } },
    };
    const model = defineModel(usersTable, ui);
    expect(model.ui).toBe(ui);
  });

  it("is valid when ui.layout is absent (no pages implied)", () => {
    const ui: UIConfig<typeof usersTable> = {};
    const model = defineModel(usersTable, ui);
    expect(model.ui.layout).toBeUndefined();
  });

  it("preserves layout when provided", () => {
    const ui: UIConfig<typeof usersTable> = {
      layout: { list: ["id", "name"] },
    };
    const model = defineModel(usersTable, ui);
    expect(model.ui.layout?.list).toEqual(["id", "name"]);
  });
});
