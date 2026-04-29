/**
 * Property-based tests for buildAITools().
 *
 * Feature: tanstack-use, Property 8: AI tools respect permission boundaries
 *
 * For any session and any model, buildAITools generates a tool for operation X
 * iff can(session, "model.X", app) returns true.
 *
 * Validates: Requirements 13.2, 13.8
 * Requirements: 10.12
 */

import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { buildAITools } from "./build-ai-tools.js";
import { defineApp, defineModel } from "@tanstack-use/core";
import { can } from "@tanstack-use/permissions";
import type { AIServerFunctions, AIOperation } from "./build-ai-tools.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

/** Minimal no-op server functions — executors are not exercised in property tests. */
const noopServerFns: AIServerFunctions = {
  list: async () => [],
  create: async () => ({}),
  update: async () => ({}),
  remove: async () => undefined,
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a non-empty array of group name strings.
 * Group names are short alphanumeric strings to keep output readable.
 */
const groupNameArb = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);

/**
 * Generates an array of group names (possibly empty) for use as
 * permission allowed-groups or member groups.
 */
const groupArrayArb = fc.array(groupNameArb, { minLength: 0, maxLength: 5 });

/**
 * Generates a permissions config for a single model.
 * Each operation independently gets either an empty array (open) or a
 * small array of group names (restricted).
 */
const permissionsArb = fc.record({
  read: groupArrayArb,
  create: groupArrayArb,
  update: groupArrayArb,
  delete: groupArrayArb,
});

// ---------------------------------------------------------------------------
// Property 8: AI tools respect permission boundaries
// ---------------------------------------------------------------------------

describe("Property 8: AI tools respect permission boundaries", () => {
  it(
    "generates a tool for operation X iff can() returns true for that operation",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          permissionsArb,
          groupArrayArb,
          async (permissions, memberGroups) => {
            // Build an App with the generated permissions
            const model = defineModel(employeeTable, { permissions });
            const auth = {
              api: { getActiveMemberGroups: async () => memberGroups },
            };
            const app = defineApp({ models: [model], auth });

            // Build AI tools
            const tools = await buildAITools(app, {}, noopServerFns);

            // For each operation, assert tool presence matches can() result
            const operations: AIOperation[] = ["list", "create", "update", "delete"];

            for (const operation of operations) {
              const toolName = `${operation}Employee`;
              const toolPresent = toolName in tools;

              // Map AI operation to permission key (list → read)
              const permissionKey = operation === "list" ? "read" : operation;

              // Compute expected result using can() directly
              const expected = await can({}, `employee.${permissionKey}`, app);

              expect(toolPresent).toBe(expected);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    "open-access model (all empty permission arrays) always generates all four tools",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          groupArrayArb, // member groups don't matter for open access
          async (memberGroups) => {
            const model = defineModel(employeeTable, {
              permissions: { read: [], create: [], update: [], delete: [] },
            });
            const auth = {
              api: { getActiveMemberGroups: async () => memberGroups },
            };
            const app = defineApp({ models: [model], auth });

            const tools = await buildAITools(app, {}, noopServerFns);

            expect(Object.keys(tools)).toContain("listEmployee");
            expect(Object.keys(tools)).toContain("createEmployee");
            expect(Object.keys(tools)).toContain("updateEmployee");
            expect(Object.keys(tools)).toContain("deleteEmployee");
          },
        ),
        { numRuns: 50 },
      );
    },
  );

  it(
    "fully restricted model generates no tools when member has no matching groups",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate at least one group for each permission so access is restricted
          fc.array(groupNameArb, { minLength: 1, maxLength: 3 }),
          async (restrictedGroups) => {
            const model = defineModel(employeeTable, {
              permissions: {
                read: restrictedGroups,
                create: restrictedGroups,
                update: restrictedGroups,
                delete: restrictedGroups,
              },
            });
            // Member belongs to groups that have NO overlap with restrictedGroups
            // We achieve this by using a fixed group name that won't appear in
            // the generated restrictedGroups (which are lowercase alphanumeric).
            const auth = {
              api: { getActiveMemberGroups: async () => ["NOMATCH_GROUP"] },
            };
            const app = defineApp({ models: [model], auth });

            const tools = await buildAITools(app, {}, noopServerFns);

            expect(Object.keys(tools)).toHaveLength(0);
          },
        ),
        { numRuns: 50 },
      );
    },
  );

  it(
    "tool count equals the number of operations for which can() returns true",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          permissionsArb,
          groupArrayArb,
          async (permissions, memberGroups) => {
            const model = defineModel(employeeTable, { permissions });
            const auth = {
              api: { getActiveMemberGroups: async () => memberGroups },
            };
            const app = defineApp({ models: [model], auth });

            const tools = await buildAITools(app, {}, noopServerFns);

            // Count how many operations are permitted
            const operations: AIOperation[] = ["list", "create", "update", "delete"];
            let permittedCount = 0;
            for (const op of operations) {
              // Map AI operation to permission key (list → read)
              const permissionKey = op === "list" ? "read" : op;
              if (await can({}, `employee.${permissionKey}`, app)) {
                permittedCount++;
              }
            }

            expect(Object.keys(tools)).toHaveLength(permittedCount);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    "member with matching group always gets the corresponding tool",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a non-empty group name that will be in both allowed and member groups
          groupNameArb,
          fc.constantFrom("list", "create", "update", "delete") as fc.Arbitrary<AIOperation>,
          async (sharedGroup, operation) => {
            const permissions = {
              // Map "list" operation to "read" permission key
              read: operation === "list" ? [sharedGroup] : [],
              create: operation === "create" ? [sharedGroup] : [],
              update: operation === "update" ? [sharedGroup] : [],
              delete: operation === "delete" ? [sharedGroup] : [],
            };
            const model = defineModel(employeeTable, { permissions });
            const auth = {
              api: { getActiveMemberGroups: async () => [sharedGroup] },
            };
            const app = defineApp({ models: [model], auth });

            const tools = await buildAITools(app, {}, noopServerFns);

            const toolName = `${operation}Employee`;
            expect(Object.keys(tools)).toContain(toolName);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
