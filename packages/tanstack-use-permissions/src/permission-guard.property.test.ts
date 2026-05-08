// Feature: tanstack-use, Property 4: Permission evaluation is correct for all group combinations

import { pgTable, serial, text } from "drizzle-orm/pg-core";
import * as fc from "fast-check";
import { defineApp, defineModel } from "@tanstack-use/core";
import { describe, expect, it } from "vitest";
import { can } from "./permission-guard.js";

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const mockSession = {};

describe("Property 4: Permission evaluation is correct for all group combinations", () => {
  it("can() result equals allowedGroups.length === 0 || memberGroups intersects allowedGroups", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 })),
        fc.array(fc.string({ minLength: 1 })),
        async (allowedGroups, memberGroups) => {
          const model = defineModel(usersTable, {
            permissions: { read: allowedGroups },
          });
          const auth = {
            api: { getActiveMemberGroups: async () => memberGroups },
          };
          const app = defineApp({ models: [model] });

          const result = await can(mockSession, "users.read", auth, app);

          const expected =
            allowedGroups.length === 0 || memberGroups.some((g) => allowedGroups.includes(g));

          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
