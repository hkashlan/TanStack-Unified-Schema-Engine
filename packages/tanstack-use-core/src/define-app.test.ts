import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { defineApp } from "./define-app.js";
import { defineModel } from "./define-model.js";

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});

describe("defineApp()", () => {
  it("registers models in the map keyed by table name", () => {
    const userModel = defineModel(usersTable, {});
    const app = defineApp({ models: [userModel] });

    expect(app._tag).toBe("App");
    expect(app.models.has("users")).toBe(true);
    expect(app.models.get("users")).toBe(userModel);
  });

  it("registers multiple models keyed by their respective table names", () => {
    const userModel = defineModel(usersTable, {});
    const postModel = defineModel(postsTable, {});
    const app = defineApp({ models: [userModel, postModel] });

    expect(app.models.size).toBe(2);
    expect(app.models.get("users")).toBe(userModel);
    expect(app.models.get("posts")).toBe(postModel);
  });

  it("throws on duplicate table names", () => {
    const model1 = defineModel(usersTable, {});
    const model2 = defineModel(usersTable, { fields: { name: { label: "Name" } } });

    expect(() => defineApp({ models: [model1, model2] })).toThrow(
      "Duplicate model: users",
    );
  });

  it("works with an empty models array", () => {
    const app = defineApp({ models: [] });

    expect(app._tag).toBe("App");
    expect(app.models.size).toBe(0);
  });
});
