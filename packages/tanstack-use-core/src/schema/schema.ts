/**
 * Drizzle schema for the tanstack-use framework.
 *
 * Re-exports Better Auth's generated auth tables and aliases the `user`
 * table as `usersTable` for consistency with the rest of the schema API.
 *
 * Role and permission storage is now handled entirely by Better Auth's
 * `organization` plugin (`organizationRole` table) — the custom `roles`
 * and `user_roles` tables have been removed.
 */

import { user } from "./auth-schema.js";
export * from "./auth-schema.js";

/**
 * Alias for Better Auth's `user` table — exported as `usersTable` for
 * consistency with the rest of the schema API.
 */
export { user as usersTable };
