# auth-permissions-schema Bugfix Design

## Overview

Two structural defects exist in `@tanstack-use/permissions` and the `tanstack-use-todo` reference app.

**Bug 1 — Auth route coupling**: The TanStack Start catch-all route that wires Better Auth's HTTP handler lives in `packages/tanstack-use-todo/src/routes/api/auth/$.ts`. Because `@tanstack-use/permissions` already owns `defineAuth`, this wiring should be generalized and exported from the package so any app can register the auth route without duplicating boilerplate.

**Bug 2 — Schema issues in `packages/tanstack-use-permissions/src/schema.ts`**:
- `rolesTable` maps to `tanstack_use_roles` — should be `roles`
- `userRolesTable` maps to `tanstack_use_user_roles` — should be `user_roles`
- No `usersTable` exists — need to add one mapped to `user` (matching Better Auth's own table name)
- `userRolesTable.userId` is a plain `text` column with no FK reference — should reference `usersTable.id`

The fix strategy is minimal and targeted: rename the two tables, add `usersTable`, add the FK reference, and export a reusable `createAuthRoute` factory from the permissions package. No existing runtime behavior changes.

---

## Glossary

- **Bug_Condition (C)**: The condition that identifies a defective state — either the auth route handler lives only in the app, or the permissions schema carries incorrect table names / missing FK.
- **Property (P)**: The desired correct behavior once the fix is applied — auth route is exportable from the package; schema tables use plain names with a proper FK.
- **Preservation**: Existing runtime behavior that must remain unchanged — `defineAuth` output, `can()` resolution, `drizzle-kit generate` compatibility, and the todo app's schema re-exports.
- **`defineAuth`**: Function in `packages/tanstack-use-permissions/src/define-auth.ts` that wraps `betterAuth` and enforces the `organization` and `tanstackStartCookies` plugins.
- **`createPermissionsAdapter`**: Function in `packages/tanstack-use-permissions/src/permissions-adapter.ts` that returns a `BetterAuthInstance` resolving role names by joining `user_roles → roles`.
- **`rolesTable`**: Drizzle table definition for the `roles` table (currently misnamed `tanstack_use_roles`).
- **`userRolesTable`**: Drizzle table definition for the `user_roles` join table (currently misnamed `tanstack_use_user_roles`, missing FK).
- **`usersTable`**: Missing Drizzle table definition that should map to Better Auth's `user` table.
- **`createAuthRoute`**: The factory function to be added to `@tanstack-use/permissions` that uses `createRoute` from `@tanstack/react-router` to create a fully registered code-based route for `/api/auth/$`, accepting the app's root route and auth instance as parameters.
- **`rootRouteImport`**: The root route object exported from the app's `routeTree.gen.ts`. Passed into `createAuthRoute` so the library can set `getParentRoute` without importing from the app (which would be a circular dependency).
- **`routeTree.addChildren`**: TanStack Router API used in `router.tsx` to merge the code-based auth route into the file-based route tree.

---

## Bug Details

### Bug Condition — Auth Route Coupling

The bug manifests when a developer adopts `@tanstack-use/permissions` and must manually create a `routes/api/auth/$.ts` file that duplicates the Better Auth handler wiring. The `defineAuth` function already owns the auth instance, so the route handler should be derivable from it without app-level boilerplate.

**Formal Specification:**
```
FUNCTION isBugCondition_AuthRoute(X)
  INPUT: X of type AppPackage
  OUTPUT: boolean

  RETURN X.authRouteHandler NOT IN "@tanstack-use/permissions"
         AND X.authRouteHandler IN "app-specific routes directory"
END FUNCTION
```

### Bug Condition — Schema Issues

The bug manifests when `drizzle-kit generate` processes `packages/tanstack-use-permissions/src/schema.ts` and produces tables with the `tanstack_use_` prefix, or when a consumer tries to join `user_roles` against a users table and finds no `usersTable` export and no FK constraint.

**Formal Specification:**
```
FUNCTION isBugCondition_Schema(X)
  INPUT: X of type PermissionsSchema
  OUTPUT: boolean

  RETURN ("tanstack_use_roles" IN X.tableNames)
         OR ("tanstack_use_user_roles" IN X.tableNames)
         OR ("user" NOT IN X.tableNames AND "user_roles" IN X.tableNames)
         OR (X.userRolesTable.userId.foreignKey = NONE)
END FUNCTION
```

### Examples

**Auth Route Coupling:**
- A new app calls `defineAuth(...)` and gets a working auth instance, but must still create `routes/api/auth/$.ts` manually — the package provides no reusable route factory.
- Two apps in the same monorepo each have an identical `routes/api/auth/$.ts` file; a change to the handler pattern must be applied in both places.
- The library cannot call `createRoute` itself because `getParentRoute` requires the app's root route object, which would create a circular dependency if imported directly.

**Schema Issues:**
- Running `npx drizzle-kit generate` produces a migration creating `tanstack_use_roles` and `tanstack_use_user_roles` — inconsistent with Better Auth's own `user`, `session`, `account` naming.
- A consumer writes `db.select().from(userRolesTable).innerJoin(usersTable, ...)` and finds `usersTable` is not exported from `@tanstack-use/permissions/server`, forcing them to use the magic string `"user"`.
- The database allows inserting a `user_roles` row with a `user_id` that references no existing user, because no FK constraint exists.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `defineAuth({ database, emailAndPassword, plugins })` MUST continue to return a fully configured Better Auth instance with `organization` and `tanstackStartCookies` plugins applied.
- `can(session, target, auth, app)` MUST continue to resolve role names by joining `user_roles → roles` and matching them against the model's `permissions` config.
- The todo app's `src/lib/schema.ts` re-exports of `rolesTable` and `userRolesTable` MUST continue to be picked up by `drizzle-kit generate`.
- The `@tanstack-use/permissions/server` export path MUST continue to work — no breaking changes to the package's public API surface.
- The todo app's existing auth route (`routes/api/auth/$.ts`) SHALL be deleted — `createAuthRoute` in `router.tsx` fully replaces it with zero HTTP behavior change.

**Scope:**
All inputs that do NOT involve the schema table names or the auth route file are completely unaffected by this fix. This includes:
- All `can()` permission checks at runtime
- All `defineAuth` call sites
- All `createPermissionsAdapter` call sites
- All model definitions using `defineModel`

**Note:** The actual expected correct behavior after the fix is defined in the Correctness Properties section (Properties 1 and 2).

---

## Hypothesized Root Cause

### Bug 1 — Auth Route Coupling

1. **Missing abstraction layer**: `defineAuth` was designed to configure the auth instance but not to provide the HTTP wiring. The route handler was left to the app as an afterthought, with no factory function planned in the package.

2. **No server-route export**: `packages/tanstack-use-permissions/src/server.ts` exports `defineAuth`, `createPermissionsAdapter`, `rolesTable`, and `userRolesTable`, but no route-level utility. The package's scope was not extended to cover TanStack Start route creation.

### Bug 2 — Schema Issues

1. **Overly defensive table naming**: The `tanstack_use_` prefix was likely added to avoid collisions with app-defined tables, but it conflicts with Better Auth's own convention of using plain, unprefixed names (`user`, `session`, `account`, `member`, etc.).

2. **Missing `usersTable` definition**: The schema was written to cover only the permissions-specific tables (`roles`, `user_roles`). The Better Auth `user` table was assumed to be managed entirely by Better Auth, so no Drizzle reference table was defined — leaving consumers unable to express FK relationships or joins in a type-safe way.

3. **Missing FK constraint on `userRolesTable.userId`**: When `usersTable` did not exist in the schema, there was no target for a FK reference. The column was left as a plain `text` field, which means the database cannot enforce referential integrity between `user_roles.user_id` and `user.id`.

4. **`roleId` column type mismatch**: `userRolesTable.roleId` is declared as `serial("role_id")` rather than `integer("role_id").references(() => rolesTable.id)`. `serial` auto-increments and is semantically wrong for a FK column — it should be a plain `integer` with an explicit `.references()` call.

---

## Correctness Properties

Property 1: Bug Condition — Auth Route Is Owned by Package

_For any_ app that calls `defineAuth(options)` and needs to register a Better Auth HTTP handler, the fixed `@tanstack-use/permissions` package SHALL export a `createAuthRoute(rootRoute, auth)` factory that uses `createRoute` from `@tanstack/react-router` to create a fully registered `/api/auth/$` route with `GET` and `POST` handlers both delegating to `auth.handler(request)`. The app SHALL register this route by calling `routeTree.addChildren([createAuthRoute(rootRouteImport, auth)])` in `router.tsx`, with no `routes/api/auth/$.ts` file required.

**Validates: Requirements 2.1**

Property 2: Bug Condition — Schema Uses Correct Table Names with FK

_For any_ invocation of `drizzle-kit generate` against a schema that imports `rolesTable`, `userRolesTable`, and `usersTable` from `@tanstack-use/permissions/server`, the fixed schema SHALL produce migrations that create tables named `roles`, `user_roles`, and `user` (no `tanstack_use_` prefix), where `user_roles.user_id` carries a foreign-key constraint referencing `user.id` and `user_roles.role_id` carries a foreign-key constraint referencing `roles.id`.

**Validates: Requirements 2.2, 2.3, 2.4**

Property 3: Preservation — `defineAuth` Runtime Behavior Unchanged

_For any_ call to `defineAuth(options)` where the bug condition does NOT hold (i.e., the schema is already correct and the route factory is not involved), the fixed code SHALL produce exactly the same Better Auth instance as the original code, with `organization` and `tanstackStartCookies` plugins applied and all `options` forwarded unchanged.

**Validates: Requirements 3.1**

Property 4: Preservation — `can()` Role Resolution Unchanged

_For any_ call to `can(session, target, auth, app)`, the fixed `createPermissionsAdapter` SHALL continue to resolve role names by joining `user_roles → roles` on `role_id = roles.id` and filtering by `user_id = session.user.id`, returning the same role name strings as before the fix.

**Validates: Requirements 3.2**

---

## Fix Implementation

### Changes Required

#### File: `packages/tanstack-use-permissions/src/schema.ts`

**Specific Changes:**

1. **Rename `rolesTable` table name**: Change `pgTable("tanstack_use_roles", ...)` → `pgTable("roles", ...)`.

2. **Rename `userRolesTable` table name**: Change `pgTable("tanstack_use_user_roles", ...)` → `pgTable("user_roles", ...)`.

3. **Add `usersTable`**: Add a new `pgTable("user", { id: text("id").primaryKey(), ... })` definition that mirrors the columns Better Auth writes to its `user` table. At minimum, `id` (text PK) is required for the FK reference. Additional columns (`name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`) should be included so consumers can join and select user data without magic strings.

4. **Fix `userRolesTable.userId` FK**: Change `userId: text("user_id").notNull()` → `userId: text("user_id").notNull().references(() => usersTable.id)`.

5. **Fix `userRolesTable.roleId` column type**: Change `roleId: serial("role_id").notNull()` → `roleId: integer("role_id").notNull().references(() => rolesTable.id)`. `serial` is semantically wrong for a FK column.

#### File: `packages/tanstack-use-permissions/src/server.ts`

**Specific Changes:**

6. **Export `usersTable`**: Add `usersTable` to the re-export from `./schema.js` so consumers can import it from `@tanstack-use/permissions/server`.

7. **Export `createAuthRoute`**: Add a re-export of the new `createAuthRoute` factory (see below).

#### File: `packages/tanstack-use-permissions/src/create-auth-route.ts` (new file)

**Specific Changes:**

8. **Implement `createAuthRoute` factory**: Create a new file that exports a `createAuthRoute(rootRoute, auth)` function. It uses `createRoute` from `@tanstack/react-router` to define the `/api/auth/$` route as a code-based route. The root route is passed in as a parameter to avoid a circular dependency (the library cannot import from the app's `routeTree.gen.ts`):

```typescript
import { createRoute, type AnyRoute } from "@tanstack/react-router";

export function createAuthRoute(
  rootRoute: AnyRoute,
  auth: { handler: (req: Request) => Response | Promise<Response> },
) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: "/api/auth/$",
  }).update({
    server: {
      handlers: {
        GET: ({ request }: { request: Request }) => auth.handler(request),
        POST: ({ request }: { request: Request }) => auth.handler(request),
      },
    },
  });
}
```

#### File: `packages/tanstack-use-todo/src/router.tsx`

**Specific Changes:**

9. **Register the auth route via `createAuthRoute`**: Import `createAuthRoute` from `@tanstack-use/permissions`, import `rootRouteImport` from `./routeTree.gen`, and merge the code-based route into the file-based tree using `routeTree.addChildren`:

```typescript
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree, rootRouteImport } from "./routeTree.gen";
import { createAuthRoute } from "@tanstack-use/permissions";
import { auth } from "./lib/auth";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree: routeTree.addChildren([createAuthRoute(rootRouteImport, auth)]),
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
  return router;
}
```

#### File: `packages/tanstack-use-todo/src/routes/api/auth/$.ts`

**Specific Changes:**

10. **Delete this file**: The route is now fully owned by `createAuthRoute` in `router.tsx`. The file-based route is no longer needed.

#### File: `packages/tanstack-use-todo/src/lib/schema.ts`

**Specific Changes:**

11. **Add `usersTable` re-export**: Add `usersTable` to the re-export from `@tanstack-use/permissions/server` so `drizzle-kit generate` picks it up and the todo app's schema is complete.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on the unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that inspect the schema table names, FK references, and the permissions package exports. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases:**

1. **Schema table name test** (will fail on unfixed code): Assert that `rolesTable[Symbol.for("drizzle:Name")]` equals `"roles"` — currently returns `"tanstack_use_roles"`.

2. **Schema table name test** (will fail on unfixed code): Assert that `userRolesTable[Symbol.for("drizzle:Name")]` equals `"user_roles"` — currently returns `"tanstack_use_user_roles"`.

3. **`usersTable` export test** (will fail on unfixed code): Assert that `usersTable` is exported from `@tanstack-use/permissions/server` — currently not exported.

4. **FK reference test** (will fail on unfixed code): Assert that `userRolesTable.userId` column config includes a `references` entry pointing to `usersTable.id` — currently no FK exists.

5. **`createAuthRoute` export test** (will fail on unfixed code): Assert that `createAuthRoute` is exported from `@tanstack-use/permissions` — currently not exported.

6. **`routes/api/auth/$.ts` existence test** (will fail on unfixed code): Assert that `routes/api/auth/$.ts` does NOT exist after the fix — currently it exists as app-level boilerplate.

**Expected Counterexamples:**
- `rolesTable` table name is `"tanstack_use_roles"`, not `"roles"`
- `userRolesTable` table name is `"tanstack_use_user_roles"`, not `"user_roles"`
- `usersTable` is `undefined` when imported from `@tanstack-use/permissions/server`
- `userRolesTable.userId` has no FK reference config
- `createAuthRoute` is `undefined` when imported from `@tanstack-use/permissions`
- `routes/api/auth/$.ts` exists in the app's routes directory

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL schema WHERE isBugCondition_Schema(schema) DO
  result := applySchemaFix(schema)
  ASSERT result.rolesTable.tableName = "roles"
  ASSERT result.userRolesTable.tableName = "user_roles"
  ASSERT result.usersTable.tableName = "user"
  ASSERT result.userRolesTable.userId.references = result.usersTable.id
  ASSERT result.userRolesTable.roleId.references = result.rolesTable.id
END FOR

FOR ALL app WHERE isBugCondition_AuthRoute(app) DO
  result := applyAuthRouteFix(app)
  ASSERT createAuthRoute IS exported from "@tanstack-use/permissions"
  ASSERT createAuthRoute(rootRoute, auth) returns a Route with path "/api/auth/$"
  ASSERT createAuthRoute(rootRoute, auth).server.handlers.GET({ request }) = auth.handler(request)
  ASSERT createAuthRoute(rootRoute, auth).server.handlers.POST({ request }) = auth.handler(request)
  ASSERT "routes/api/auth/$.ts" NOT IN app.files
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL options WHERE NOT isBugCondition_AuthRoute(options) DO
  ASSERT defineAuth_original(options) = defineAuth_fixed(options)
END FOR

FOR ALL session WHERE NOT isBugCondition_Schema(schema) DO
  ASSERT createPermissionsAdapter_original(db).api.getActiveMemberGroups(session)
       = createPermissionsAdapter_fixed(db).api.getActiveMemberGroups(session)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking of `createPermissionsAdapter` because:
- It generates many session shapes automatically, covering null users, missing IDs, and valid sessions
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that role resolution is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior of `createPermissionsAdapter` on the unfixed code for various session shapes, then write property-based tests capturing that behavior.

**Test Cases:**

1. **Null session preservation**: Verify `getActiveMemberGroups(null)` returns `[]` on unfixed code, then assert the same after fix.
2. **Missing user ID preservation**: Verify `getActiveMemberGroups({ user: {} })` returns `[]` on unfixed code, then assert the same after fix.
3. **`defineAuth` plugin preservation**: Verify the returned auth instance includes `organization` and `tanstackStartCookies` plugins after fix.
4. **`can()` unrestricted access preservation**: Verify `can(session, "model.read", auth, app)` returns `true` when `permissions.read = []` after fix.

### Unit Tests

- Test that `rolesTable`, `userRolesTable`, and `usersTable` carry the correct Drizzle table names after the fix.
- Test that `userRolesTable.userId` references `usersTable.id` and `userRolesTable.roleId` references `rolesTable.id`.
- Test that `createAuthRoute(rootRoute, auth)` returns a route object with path `"/api/auth/$"` and `server.handlers.GET`/`POST` that delegate to `auth.handler`.
- Test edge cases: `createAuthRoute` called with a mock auth whose `handler` throws — verify the error propagates.

### Property-Based Tests

- Generate random session objects (null, missing user, valid user with random ID) and verify `getActiveMemberGroups` returns `[]` for sessions without a valid `user.id` — behavior must be identical before and after the fix.
- Generate random `defineAuth` option objects and verify the returned instance always has `organization` and `tanstackStartCookies` in its plugin list.
- Generate random HTTP request objects and verify `createAuthRoute(rootRoute, auth).server.handlers.GET(req)` and `.POST(req)` always call `auth.handler` with the same request.

### Integration Tests

- Run `drizzle-kit generate` against the fixed schema and verify the output SQL creates `roles`, `user_roles`, and `user` tables with the correct FK constraints and no `tanstack_use_` prefix.
- Verify the todo app's `src/lib/schema.ts` re-exports `rolesTable`, `userRolesTable`, and `usersTable` and that all three appear in the generated migration.
- Verify the todo app's `router.tsx` using `createAuthRoute(rootRouteImport, auth)` produces the same HTTP behavior as the original `routes/api/auth/$.ts` inline handler.
- Verify `routes/api/auth/$.ts` no longer exists in the todo app.
