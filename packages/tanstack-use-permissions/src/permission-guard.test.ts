import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { defineApp, defineModel } from "@tanstack-use/core";
import { describe, expect, it } from "vitest";
import { can } from "./permission-guard.js";

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

/** Build a mock App and auth adapter with a controllable group list */
function makeAppAndAuth(allowedGroups: string[], memberGroups: string[]) {
  const model = defineModel(usersTable, {
    permissions: { read: allowedGroups },
  });
  const auth = {
    api: { getActiveMemberGroups: async () => memberGroups },
  };
  const app = defineApp({ models: [model] });
  return { app, auth };
}

const mockSession = {};

describe("can()", () => {
  it("returns false for a member with no matching group", async () => {
    const { app, auth } = makeAppAndAuth(["admin"], ["viewer"]);
    const result = await can(mockSession, "users.read", auth, app);
    expect(result).toBe(false);
  });

  it("returns true for a member with a matching group", async () => {
    const { app, auth } = makeAppAndAuth(["admin", "editor"], ["editor"]);
    const result = await can(mockSession, "users.read", auth, app);
    expect(result).toBe(true);
  });

  it("returns true when the permission array is empty", async () => {
    const { app, auth } = makeAppAndAuth([], ["viewer"]);
    const result = await can(mockSession, "users.read", auth, app);
    expect(result).toBe(true);
  });

  it("returns true when the permission key is absent from the model", async () => {
    const model = defineModel(usersTable, {}); // no permissions at all
    const auth = { api: { getActiveMemberGroups: async () => [] } };
    const app = defineApp({ models: [model] });
    const result = await can(mockSession, "users.read", auth, app);
    expect(result).toBe(true);
  });

  it("throws Error('Unknown model: ...') for an unregistered model name", async () => {
    const { app, auth } = makeAppAndAuth([], []);
    await expect(can(mockSession, "nonexistent.read", auth, app)).rejects.toThrow(
      "Unknown model: nonexistent",
    );
  });
});
