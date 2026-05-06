/**
 * Preservation Property Tests — `defineAuth` Plugin Behavior and `createPermissionsAdapter` Role Resolution
 *
 * These tests run on UNFIXED code and are EXPECTED TO PASS.
 * They establish the baseline behavior that must be preserved after the fix.
 *
 * Validates: Requirements 3.1, 3.2
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { defineAuth } from "./lib/auth.js";
import { createPermissionsAdapter } from "./permissions-adapter.js";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------
// `createPermissionsAdapter` calls db.select(...).from(...).innerJoin(...).where(...)
// We need a chainable mock that ultimately resolves to an empty array.

function makeMockDb(): PgDatabase<PgQueryResultHKT> {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => Promise.resolve([]),
  };
  return {
    select: () => chain,
  } as unknown as PgDatabase<PgQueryResultHKT>;
}

// ---------------------------------------------------------------------------
// Mock DB options for defineAuth
// ---------------------------------------------------------------------------
// `defineAuth` passes options straight to `betterAuth`. We only need the
// `database` field to satisfy the type; we use a minimal stub.

const mockDbOptions = {
  // biome-ignore lint/suspicious/noExplicitAny: intentional stub for testing
  database: {} as any,
};

// ---------------------------------------------------------------------------
// Property A: defineAuth always applies organization and tanstackStartCookies plugins
// ---------------------------------------------------------------------------
// Validates: Requirements 3.1

describe("Property A: defineAuth always applies organization and tanstackStartCookies plugins", () => {
  it("returned instance has organization and tanstackStartCookies in its plugin list for any options shape", () => {
    fc.assert(
      fc.property(
        fc.record({
          emailAndPassword: fc.record({
            enabled: fc.boolean(),
          }),
        }),
        (extraOptions) => {
          const options = { ...mockDbOptions, ...extraOptions };
          const instance = defineAuth(options);

          // Better Auth stores the resolved plugins on the `options.plugins` array
          // of the returned instance. We check the instance has the expected plugins.
          // biome-ignore lint/suspicious/noExplicitAny: inspecting internal structure
          const plugins: unknown[] = (instance as any).options?.plugins ?? [];

          const pluginIds = plugins
            // biome-ignore lint/suspicious/noExplicitAny: inspecting internal structure
            .map((p: any) => p?.id)
            .filter(Boolean);

          expect(pluginIds).toContain("organization");
          expect(pluginIds).toContain("tanstack-start-cookies");
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property B: getActiveMemberGroups returns [] for sessions without a valid user.id
// ---------------------------------------------------------------------------
// Validates: Requirements 3.2

describe("Property B: getActiveMemberGroups returns [] for sessions without a valid user.id", () => {
  it("returns [] for null, missing user, or user without id", async () => {
    const db = makeMockDb();
    const adapter = createPermissionsAdapter(db);

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(null),
          fc.record({ user: fc.record({ id: fc.constant(undefined) }) }),
          fc.constant({ user: {} }),
        ),
        async (session) => {
          const result = await adapter.api.getActiveMemberGroups(session);
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property C: getActiveMemberGroups returns an array of strings for any valid session
// ---------------------------------------------------------------------------
// Validates: Requirements 3.2

describe("Property C: getActiveMemberGroups returns an array of strings for any valid session", () => {
  it("returns string[] for any session with a non-empty user.id (type-level preservation)", async () => {
    const db = makeMockDb();
    const adapter = createPermissionsAdapter(db);

    await fc.assert(
      fc.asyncProperty(
        fc.record({ user: fc.record({ id: fc.string({ minLength: 1 }) }) }),
        async (session) => {
          const result = await adapter.api.getActiveMemberGroups(session);
          expect(Array.isArray(result)).toBe(true);
          for (const item of result) {
            expect(typeof item).toBe("string");
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
