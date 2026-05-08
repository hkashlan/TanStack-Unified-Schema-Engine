# Implementation Plan: Dynamic Permission System

## Overview

Replace the custom `rolesTable` / `userRolesTable` schema and `createPermissionsAdapter` indirection with Better Auth's native `organization` plugin configured for dynamic access control. The implementation proceeds in dependency order: generate the AC instance first, wire it into the auth server and client, rewrite the permission guard, clean up the old schema and exports, update all call sites, then generate and apply the migration.

## Tasks

- [x] 1. Create `permission-generator.ts` in `packages/tanstack-use-core/src/`
  - Create `packages/tanstack-use-core/src/permission-generator.ts` with two exported functions:
    - `generatePermissions(models: Map<string, Model<PgTable>>): Record<string, readonly CrudAction[]>` — iterates `models.keys()` and maps each name to `["create", "read", "update", "delete"]`
    - `buildAc(models: Map<string, Model<PgTable>>)` — calls `generatePermissions`, then passes the result to `createAccessControl` from `better-auth/plugins/access` and returns the AC instance
  - Define `CRUD_ACTIONS = ["create", "read", "update", "delete"] as const` and `CrudAction` type
  - Import `createAccessControl` from `better-auth/plugins/access`
  - Import `Model` type from `./types.js` and `PgTable` from `drizzle-orm/pg-core`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Export `generatePermissions` and `buildAc` from `packages/tanstack-use-core/src/index.ts`
  - Add `export { generatePermissions, buildAc } from "./permission-generator.js";` to the public API barrel
  - _Requirements: 2.1, 2.4_

- [ ] 3. Update `packages/tanstack-use-core/src/auth.ts` to use `buildAc` with dynamic access control
  - Import `buildAc` from `./permission-generator.js`
  - Import `appClient` from `./client.js`
  - Inside `getAuthConfig`, replace the commented-out `organization()` call with `organization({ ac: buildAc(appClient.models), dynamicAccessControl: { enabled: true } })`
  - Keep `admin()` and `tanstackStartCookies()` plugins in place
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Update `packages/tanstack-use-core/src/client.ts` to add `organizationClient` with dynamic access control
  - Import `organizationClient` from `better-auth/client/plugins`
  - Pass `organizationClient({ dynamicAccessControl: { enabled: true } })` in the `plugins` array of `createAuthClient()`
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Rewrite `packages/tanstack-use-permissions/src/permission-guard.ts` to delegate to `auth.api.hasPermission`
  - Replace the `BetterAuthInstance` import with `AuthInstance` from `@tanstack-use/core/auth`
  - Update the `can()` signature: `auth` parameter type changes from `BetterAuthInstance` to `AuthInstance`
  - Parse `target` on `:` (not `.`): throw `Error("Invalid permission target: ...")` if no `:` is found
  - Throw `Error("Unknown model: ...")` if the model is not in `appClient.models`
  - If `allowedRoles.length === 0`, return `true` immediately without calling `hasPermission`
  - Otherwise call `auth.api.hasPermission({ headers: ..., body: { permissions: { [modelName]: [operation] } } })` and return `result.success === true`
  - Extract headers from the session object: `(session as unknown as { headers?: Headers }).headers ?? new Headers()`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 7.3, 8.2, 8.3_

- [ ] 6. Update `packages/tanstack-use-permissions/src/server.ts` to remove `createPermissionsAdapter` export
  - Remove the `export { createPermissionsAdapter }` line and the `export type { BetterAuthInstance }` line
  - Keep only `export { createAuthRoute } from "./create-auth-route.js";`
  - _Requirements: 6.3_

- [ ] 7. Update `packages/tanstack-use-permissions/src/index.ts` to clean up exports
  - Remove `export type { BetterAuthInstance } from "./permissions-adapter.js";` — this type is no longer part of the public API
  - Verify `can`, `AuthorizationError`, and `createAuthRoute` remain exported without changes
  - _Requirements: 6.4_

- [ ] 8. Remove `rolesTable` and `userRolesTable` from `packages/tanstack-use-core/src/schema/schema.ts`
  - Delete the `rolesTable` and `userRolesTable` table definitions and their imports (`integer`, `serial`, `unique`)
  - Keep `export * from "./auth-schema.js"` and `export { user as usersTable }` intact
  - _Requirements: 6.1, 6.2_

- [ ] 9. Update all call sites in `packages/tanstack-use-ui/src/server.functions.ts` that use the `.` separator
  - Change every `can(session, \`${tableName}.create\`)` → `can(session, \`${tableName}:create\`)`
  - Change every `can(session, \`${tableName}.update\`)` → `can(session, \`${tableName}:update\`)`
  - Change every `can(session, \`${tableName}.delete\`)` → `can(session, \`${tableName}:delete\`)`
  - Change every `can(session, \`${tableName}.read\`)` → `can(session, \`${tableName}:read\`)` (in UI components if applicable)
  - Update the same separator in `packages/tanstack-use-ui/src/components/DetailPage.tsx` and `packages/tanstack-use-ui/src/components/CreatePage.tsx` where `can()` is called with the `.` separator
  - Remove any import of `createPermissionsAdapter` or `BetterAuthInstance` from call sites in the todo app if present
  - _Requirements: 5.1, 5.6_

- [ ] 10. Generate and apply a Drizzle migration for the `organizationRole` table
  - From `packages/tanstack-use-todo`, run `pnpm dlx drizzle-kit generate` to produce a new migration file that adds the `organizationRole` table (created by Better Auth's organization plugin with dynamic access control) and drops `roles` and `user_roles`
  - Review the generated SQL to confirm it adds `organizationRole` and removes `roles` / `user_roles`
  - Run `pnpm dlx drizzle-kit migrate` to apply the migration against the local database
  - _Requirements: 6.1, 6.2_

- [ ] 11. Final checkpoint — verify the system compiles and wires together correctly
  - Run `pnpm typecheck` from the workspace root and fix any type errors
  - Run `pnpm lint` and fix any Biome lint errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP (none in this plan per user request)
- Task 1 must be completed before Tasks 3 and 5, since both consume `buildAc` / the new guard logic
- Task 8 (schema removal) should be done before Task 10 (migration generation) so `drizzle-kit` sees the final schema state
- The `permissions-adapter.ts` file itself is not deleted — it still contains the `BetterAuthInstance` type and `createPermissionsAdapter` implementation which may be referenced by existing property tests (`preservation.property.test.ts`). Only its exports from `server.ts` and `index.ts` are removed
- The `:` separator is a deliberate breaking change from the old `.` separator; all internal call sites in `packages/tanstack-use-ui` must be updated in Task 9
