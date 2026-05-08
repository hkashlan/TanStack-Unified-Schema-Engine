/**
 * Bug Condition Exploration Tests — Schema Table Names, Missing FK, and Missing Exports
 *
 * These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bugs exist. This is the SUCCESS case for exploration tests.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect } from "vitest";
import { rolesTable, userRolesTable } from "./schema.js";
import { usersTable } from "@tanstack-use/permissions/server";
import { createAuthRoute } from "@tanstack-use/permissions";

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

describe("Bug Condition — Schema Table Names, Missing FK, and Missing Exports", () => {
  /**
   * Test 1 — rolesTable should use plain name "roles", not "tanstack_use_roles"
   * Counterexample: rolesTable[Symbol.for("drizzle:Name")] === "tanstack_use_roles"
   */
  it('rolesTable maps to "roles" (not "tanstack_use_roles")', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((rolesTable as any)[DRIZZLE_NAME]).toBe("roles");
  });

  /**
   * Test 2 — userRolesTable should use plain name "user_roles", not "tanstack_use_user_roles"
   * Counterexample: userRolesTable[Symbol.for("drizzle:Name")] === "tanstack_use_user_roles"
   */
  it('userRolesTable maps to "user_roles" (not "tanstack_use_user_roles")', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((userRolesTable as any)[DRIZZLE_NAME]).toBe("user_roles");
  });

  /**
   * Test 3 — usersTable must be exported from @tanstack-use/permissions/server
   * Counterexample: usersTable is undefined when imported from the server entry point
   */
  it("usersTable is exported from @tanstack-use/permissions/server", () => {
    expect(usersTable).toBeDefined();
  });

  /**
   * Test 4 — userRolesTable.userId must have a FK reference to usersTable.id
   * Counterexample: userRolesTable.userId has no references config (plain text column)
   */
  it("userRolesTable.userId has a FK reference to usersTable.id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIdConfig = (userRolesTable as any).userId;
    // Drizzle stores FK references in the column's config under `references`
    expect(userIdConfig).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const references = (userIdConfig as any).config?.references;
    expect(references).toBeDefined();
    expect(typeof references).toBe("function");
  });

  /**
   * Test 5 — userRolesTable.roleId must be an integer (not serial) with a FK reference to rolesTable.id
   * Counterexample: userRolesTable.roleId is serial with no FK reference config
   */
  it("userRolesTable.roleId is an integer column with a FK reference to rolesTable.id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleIdConfig = (userRolesTable as any).roleId;
    expect(roleIdConfig).toBeDefined();
    // serial columns have columnType "PgSerial"; integer columns have "PgInteger"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columnType = (roleIdConfig as any).columnType;
    expect(columnType).toBe("PgInteger");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const references = (roleIdConfig as any).config?.references;
    expect(references).toBeDefined();
    expect(typeof references).toBe("function");
  });

  /**
   * Test 6 — createAuthRoute must be exported from @tanstack-use/permissions
   * Counterexample: createAuthRoute is undefined when imported from the main entry point
   */
  it("createAuthRoute is exported from @tanstack-use/permissions", () => {
    expect(createAuthRoute).toBeDefined();
    expect(typeof createAuthRoute).toBe("function");
  });
});
