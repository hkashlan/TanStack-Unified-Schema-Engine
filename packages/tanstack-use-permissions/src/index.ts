// Client-safe exports
export { AuthorizationError } from "./authorization-error.js";
export { can } from "./permission-guard.js";
export { createAuthRoute } from "./create-auth-route.js";
export * from './auth-client.js';

// Server-only exports — import directly from their source files inside "use server" modules,
// never from this barrel in client code:
//   defineAuth           → "@tanstack-use/permissions/src/define-auth.js"
//   createPermissionsAdapter → "@tanstack-use/permissions/src/permissions-adapter.js"
//   rolesTable, userRolesTable → "@tanstack-use/permissions/src/schema.js"
export type { BetterAuthInstance } from "./permissions-adapter.js";
