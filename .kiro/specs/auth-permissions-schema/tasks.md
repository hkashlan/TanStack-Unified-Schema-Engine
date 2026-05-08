# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Schema Table Names, Missing FK, and Missing Exports
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: These are deterministic structural bugs; scope the property to the concrete failing cases for reproducibility
  - Create `packages/tanstack-use-permissions/src/schema.property.test.ts`
  - Test 1 — Assert `rolesTable[Symbol.for("drizzle:Name")]` equals `"roles"` (currently `"tanstack_use_roles"`)
  - Test 2 — Assert `userRolesTable[Symbol.for("drizzle:Name")]` equals `"user_roles"` (currently `"tanstack_use_user_roles"`)
  - Test 3 — Assert `usersTable` is exported from `@tanstack-use/permissions/server` (currently `undefined`)
  - Test 4 — Assert `userRolesTable.userId` column config includes a `references` entry pointing to `usersTable.id` (currently no FK)
  - Test 5 — Assert `userRolesTable.roleId` is an `integer` column (not `serial`) with a `references` entry pointing to `rolesTable.id` (currently `serial`, no FK)
  - Test 6 — Assert `createAuthRoute` is exported from `@tanstack-use/permissions` (currently `undefined`)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found:
    - `rolesTable` table name is `"tanstack_use_roles"`, not `"roles"`
    - `userRolesTable` table name is `"tanstack_use_user_roles"`, not `"user_roles"`
    - `usersTable` is `undefined` when imported from `@tanstack-use/permissions/server`
    - `userRolesTable.userId` has no FK reference config
    - `userRolesTable.roleId` is `serial` with no FK reference config
    - `createAuthRoute` is `undefined` when imported from `@tanstack-use/permissions`
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - `defineAuth` Plugin Behavior and `createPermissionsAdapter` Role Resolution
  - **IMPORTANT**: Follow observation-first methodology
  - Create `packages/tanstack-use-permissions/src/preservation.property.test.ts`
  - **Observation phase on UNFIXED code** (inputs where bug condition does NOT hold):
    - Observe: `defineAuth({ database: mockDb, emailAndPassword: { enabled: true } })` returns an instance with `organization` and `tanstackStartCookies` plugins applied
    - Observe: `createPermissionsAdapter(db).api.getActiveMemberGroups(null)` returns `[]`
    - Observe: `createPermissionsAdapter(db).api.getActiveMemberGroups({ user: {} })` returns `[]`
    - Observe: `createPermissionsAdapter(db).api.getActiveMemberGroups({ user: { id: "abc" } })` returns `[]` when no rows exist in DB
  - **Property-based tests** (using `fast-check`):
    - Property A: For any `defineAuth` options object, the returned instance always has `organization` and `tanstackStartCookies` in its plugin list — generate random option shapes with `fc.record`
    - Property B: For any session object where `user.id` is absent or falsy (null, undefined, `{}`), `getActiveMemberGroups` returns `[]` — generate with `fc.oneof(fc.constant(null), fc.record({ user: fc.record({ id: fc.constant(undefined) }) }), fc.constant({ user: {} }))`
    - Property C: For any valid session with a random `user.id` string, `getActiveMemberGroups` returns an array of strings (type-level preservation) — generate with `fc.record({ user: fc.record({ id: fc.string({ minLength: 1 }) }) })`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix schema table names, add usersTable, fix FK references, add createAuthRoute, update exports

  - [x] 3.1 Fix `packages/tanstack-use-permissions/src/schema.ts`
    - Rename `rolesTable` table name: `pgTable("tanstack_use_roles", ...)` → `pgTable("roles", ...)`
    - Rename `userRolesTable` table name: `pgTable("tanstack_use_user_roles", ...)` → `pgTable("user_roles", ...)`
    - Add `usersTable` mapped to `"user"` with columns: `id` (text PK), `name` (text), `email` (text), `emailVerified` (boolean), `image` (text nullable), `createdAt` (timestamp), `updatedAt` (timestamp) — mirrors Better Auth's own `user` table
    - Fix `userRolesTable.userId` FK: change `text("user_id").notNull()` → `text("user_id").notNull().references(() => usersTable.id)`
    - Fix `userRolesTable.roleId` column type: change `serial("role_id").notNull()` → `integer("role_id").notNull().references(() => rolesTable.id)`
    - Add `integer`, `boolean`, `timestamp` to drizzle-orm imports as needed
    - _Bug_Condition: isBugCondition_Schema(X) where X.tableNames contains "tanstack_use_roles" or "tanstack_use_user_roles", or "user" NOT IN X.tableNames, or X.userRolesTable.userId.foreignKey = NONE_
    - _Expected_Behavior: rolesTable.tableName = "roles", userRolesTable.tableName = "user_roles", usersTable.tableName = "user", userRolesTable.userId references usersTable.id, userRolesTable.roleId references rolesTable.id_
    - _Preservation: rolesTable and userRolesTable remain exported; drizzle-kit generate continues to pick them up from the todo app's schema.ts re-export_
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.2 Create `packages/tanstack-use-permissions/src/create-auth-route.ts`
    - New file implementing `createAuthRoute(rootRoute: AnyRoute, auth: { handler: (req: Request) => Response | Promise<Response> })`
    - Import `createRoute` and `type AnyRoute` from `@tanstack/react-router`
    - Use `createRoute({ getParentRoute: () => rootRoute, path: "/api/auth/$" })` to define the route
    - Call `.update({ server: { handlers: { GET: ({ request }) => auth.handler(request), POST: ({ request }) => auth.handler(request) } } })` on the created route
    - Export `createAuthRoute` as a named export
    - Use `.js` extension on all internal imports
    - _Bug_Condition: isBugCondition_AuthRoute(X) where createAuthRoute NOT IN "@tanstack-use/permissions"_
    - _Expected_Behavior: createAuthRoute(rootRoute, auth) returns a Route with path "/api/auth/$" and GET/POST handlers delegating to auth.handler_
    - _Preservation: No existing exports are changed; this is a purely additive new file_
    - _Requirements: 2.1_

  - [x] 3.3 Update `packages/tanstack-use-permissions/src/server.ts`
    - Add `usersTable` to the re-export from `./schema.js`
    - Add `createAuthRoute` re-export from `./create-auth-route.js`
    - _Requirements: 2.1, 2.4_

  - [x] 3.4 Update `packages/tanstack-use-permissions/src/index.ts`
    - Add `createAuthRoute` to the client-safe exports (it only imports from `@tanstack/react-router`, no server-only deps)
    - _Requirements: 2.1_

  - [x] 3.5 Update `packages/tanstack-use-todo/src/router.tsx`
    - Import `createAuthRoute` from `@tanstack-use/permissions`
    - Import `rootRouteImport` from `./routeTree.gen` (alongside existing `routeTree` import)
    - Import `auth` from `./lib/auth`
    - Change `routeTree` → `routeTree.addChildren([createAuthRoute(rootRouteImport, auth)])` in the `createTanStackRouter` call
    - _Requirements: 2.1_

  - [x] 3.6 Delete `packages/tanstack-use-todo/src/routes/api/auth/$.ts`
    - The route is now fully owned by `createAuthRoute` in `router.tsx`
    - Verify no other file imports from this route before deleting
    - _Requirements: 2.1_

  - [x] 3.7 Update `packages/tanstack-use-todo/src/lib/schema.ts`
    - Add `usersTable` to the re-export from `@tanstack-use/permissions/server`
    - Change `export { rolesTable, userRolesTable }` → `export { rolesTable, userRolesTable, usersTable }`
    - _Requirements: 2.4, 3.3_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Schema Table Names, Missing FK, and Missing Exports
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `packages/tanstack-use-permissions/src/schema.property.test.ts` on FIXED code
    - **EXPECTED OUTCOME**: All 6 assertions PASS (confirms both bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - `defineAuth` Plugin Behavior and `createPermissionsAdapter` Role Resolution
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `packages/tanstack-use-permissions/src/preservation.property.test.ts` on FIXED code
    - **EXPECTED OUTCOME**: All property tests PASS (confirms no regressions in `defineAuth` or `createPermissionsAdapter`)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `npm test` from workspace root and confirm all tests pass
  - Run `npm run typecheck` to confirm no TypeScript errors across all packages
  - Verify `packages/tanstack-use-permissions/src/schema.property.test.ts` passes (bug condition fixed)
  - Verify `packages/tanstack-use-permissions/src/preservation.property.test.ts` passes (no regressions)
  - Verify existing tests in `packages/tanstack-use-permissions/src/permission-guard.test.ts` and `permission-guard.property.test.ts` still pass
  - Ask the user if any questions arise
