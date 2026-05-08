# Bugfix Requirements Document

## Introduction

Two related structural issues exist in the `@tanstack-use/permissions` package and the `tanstack-use-todo` reference app:

1. **Auth route is app-specific**: The TanStack Start catch-all route that wires Better Auth's HTTP handler (`GET`/`POST`) lives in `packages/tanstack-use-todo/src/routes/api/auth/$.ts`. Any app that adopts the framework must duplicate this boilerplate. Because `@tanstack-use/permissions` already owns `defineAuth`, the auth route handler should be generalized and exported from that package so apps can register it without copy-pasting.

2. **Missing `usersTable` and incorrect table name prefixes in permissions schema**: `packages/tanstack-use-permissions/src/schema.ts` exports `rolesTable` (mapped to `tanstack_use_roles`) and `userRolesTable` (mapped to `tanstack_use_user_roles`), but no `usersTable`. Additionally, the `tanstack_use_` prefix on the roles tables is inconsistent — these tables should use plain names (`roles`, `user_roles`, `user`) with no framework prefix, matching Better Auth's own naming convention. The `userRolesTable.userId` column is a plain `text` field with no foreign-key reference to any users table, leaving referential integrity unenforced at the database level.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a developer creates a new app using `@tanstack-use/permissions`, THEN the system requires them to manually create a `routes/api/auth/$.ts` file that duplicates the Better Auth handler wiring already implied by `defineAuth`

1.2 WHEN `drizzle-kit generate` processes the permissions schema, THEN the system produces `tanstack_use_roles` and `tanstack_use_user_roles` tables with a `tanstack_use_` prefix that is inconsistent with Better Auth's own unprefixed table naming convention

1.3 WHEN `drizzle-kit generate` processes the permissions schema, THEN the system produces a `user_roles` table whose `user_id` column has no foreign-key constraint to any users table, leaving referential integrity unenforced at the database level

1.4 WHEN a consumer imports `rolesTable` and `userRolesTable` from `@tanstack-use/permissions/server` to build queries that join user data, THEN the system provides no `usersTable` to join against, forcing consumers to rely on Better Auth's internal table name as a magic string

### Expected Behavior (Correct)

2.1 WHEN a developer uses `@tanstack-use/permissions`, THEN the system SHALL provide a reusable TanStack Start route handler (or factory function) that wires `auth.handler` to `GET` and `POST`, so apps can register the auth route without duplicating boilerplate

2.2 WHEN `drizzle-kit generate` processes the permissions schema, THEN the system SHALL produce `roles` and `user_roles` tables with no framework prefix, consistent with Better Auth's own table naming convention

2.3 WHEN `drizzle-kit generate` processes the permissions schema, THEN the system SHALL produce a `user` table (matching Better Auth's own table name) so that `user_roles.user_id` can reference a known users table

2.4 WHEN a consumer imports from `@tanstack-use/permissions/server`, THEN the system SHALL export a `usersTable` (mapped to the `user` table name) alongside `rolesTable` and `userRolesTable` so that joins between users and roles can be expressed entirely within the permissions package's schema

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the todo app's `src/lib/auth.ts` calls `defineAuth({ database, emailAndPassword, plugins })`, THEN the system SHALL CONTINUE TO return a fully configured Better Auth instance with the `organization` and `tanstackStartCookies` plugins applied

3.2 WHEN `can(session, model, action)` is called at runtime, THEN the system SHALL CONTINUE TO resolve role names by joining `user_roles` and `roles` and matching them against the model's `permissions` config

3.3 WHEN the todo app's `src/lib/schema.ts` re-exports `rolesTable` and `userRolesTable` from `@tanstack-use/permissions/server`, THEN the system SHALL CONTINUE TO include those tables in the Drizzle schema used by `drizzle-kit generate`

3.4 WHEN a new migration is generated after the table rename, THEN the system SHALL CONTINUE TO allow apps to apply the migration without data loss (rename, not drop-and-recreate)

---

## Bug Condition Pseudocode

### Bug Condition — Auth Route Coupling

```pascal
FUNCTION isBugCondition_AuthRoute(X)
  INPUT: X of type AppPackage
  OUTPUT: boolean

  // Bug is present when the auth HTTP handler wiring lives only in the app,
  // not in the permissions package that owns defineAuth
  RETURN X.authRouteHandler NOT IN "@tanstack-use/permissions"
         AND X.authRouteHandler IN "app-specific routes directory"
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_AuthRoute(X) DO
  result ← registerAuthRoute'(X)
  ASSERT result.authRouteHandler IN "@tanstack-use/permissions"
         AND result.appRouteBoilerplate = NONE
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_AuthRoute(X) DO
  ASSERT F(X).authBehavior = F'(X).authBehavior
END FOR
```

### Bug Condition — Missing Users Table

```pascal
FUNCTION isBugCondition_UsersTable(X)
  INPUT: X of type PermissionsSchema
  OUTPUT: boolean

  // Bug is present when userRolesTable exists but usersTable does not,
  // or when roles/user_roles tables carry the tanstack_use_ prefix
  RETURN ("tanstack_use_user_roles" IN X.tables OR "tanstack_use_roles" IN X.tables)
         OR ("user" NOT IN X.tables AND "user_roles" IN X.tables)
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_UsersTable(X) DO
  result ← applySchemaFix'(X)
  ASSERT "user" IN result.tables
         AND "roles" IN result.tables
         AND "user_roles" IN result.tables
         AND result.userRolesTable.userId REFERENCES result.usersTable.id
         AND "tanstack_use_roles" NOT IN result.tables
         AND "tanstack_use_user_roles" NOT IN result.tables
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_UsersTable(X) DO
  ASSERT F(X).rolesTable = F'(X).rolesTable
         AND F(X).userRolesTable = F'(X).userRolesTable
END FOR
```
