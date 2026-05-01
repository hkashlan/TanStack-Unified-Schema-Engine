export { AuthorizationError } from "./authorization-error.js";
export { can } from "./permission-guard.js";
export { defineAuth } from "./define-auth.js";
// Adapter — pass to createServerFunctions and usePermissions
export { createPermissionsAdapter } from "./permissions-adapter.js";
export type { BetterAuthInstance } from "./permissions-adapter.js";
// Schema — import into your app's schema file for drizzle-kit migrations
export { rolesTable, userRolesTable } from "./schema.js";
