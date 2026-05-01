/**
 * Server-only entry point for @tanstack-use/permissions.
 *
 * Import from "@tanstack-use/permissions/server" inside "use server" files only.
 * Never import this from client components — it pulls in drizzle-orm and pg.
 */
export { defineAuth } from "./define-auth.js";
export { createPermissionsAdapter } from "./permissions-adapter.js";
export type { BetterAuthInstance } from "./permissions-adapter.js";
export { rolesTable, userRolesTable } from "./schema.js";
