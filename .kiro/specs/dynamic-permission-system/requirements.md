# Requirements Document

## Introduction

This feature replaces the current custom role-lookup permission system in `packages/tanstack-use-permissions` with a dynamic, model-based permission system built on Better Auth's native `organization` plugin capabilities. Instead of maintaining a separate `roles` / `user_roles` schema and a custom `getActiveMemberGroups` adapter, the system will:

1. Programmatically generate permission strings (e.g. `post:create`, `post:read`) from the registered models in `appClient.models`.
2. Build a Better Auth `ac` (access control) instance from those generated permissions.
3. Configure the `organization()` plugin with `dynamicAccessControl: { enabled: true }` so that roles and their permission assignments are stored in the database via Better Auth's native `organizationRole` table.
4. Replace the `can()` guard's custom DB lookup with a call to `auth.api.hasPermission`, delegating all permission evaluation to Better Auth's native AC engine.
5. Keep `admin()` and `tanstackStartCookies()` plugins in place, and add `organizationClient()` to the client-side auth instance.

The goal is to eliminate the custom `rolesTable` / `userRolesTable` schema and the `createPermissionsAdapter` indirection, while preserving the same `can(session, "model:operation", auth)` public API surface used by `permission-guard.ts`.

---

## Glossary

- **Permission_Generator**: The module responsible for iterating `appClient.models` and producing the `ac` statement and `createAccessControl` instance.
- **AC_Instance**: The Better Auth `AccessControl` object created by `createAccessControl(statement)` from `better-auth/plugins/access`. It is the single source of truth for which resources and actions exist.
- **Permission_String**: A colon-separated string of the form `<modelName>:<action>` where action is one of `create`, `read`, `update`, `delete`. Example: `post:create`.
- **Permission_Guard**: The `can()` function in `permission-guard.ts` that evaluates whether a session's active organization member may perform an operation.
- **Auth_Server**: The Better Auth server instance created by `createAuth()` in `packages/tanstack-use-core/src/auth.ts`, configured with `organization()`, `admin()`, and `tanstackStartCookies()` plugins.
- **Auth_Client**: The Better Auth client instance in `appClient.auth`, created via `createAuthClient()` and configured with `organizationClient()`.
- **Dynamic_Role**: A role created at runtime via `auth.api.createOrgRole` (or the client equivalent), stored in Better Auth's `organizationRole` table, with a list of Permission_Strings assigned to it.
- **Session**: The Better Auth session object of type `Session` from `@tanstack-use/core/server`, containing `user.id` and `activeOrganizationId`.
- **Target_String**: The string passed to `can()` in the format `<modelName>:<operation>`, e.g. `"todo:delete"`.
- **Model_Registry**: `appClient.models` — a `Map<string, Model<PgTable>>` populated by `defineApp()`.

---

## Requirements

### Requirement 1: Programmatic Permission String Generation

**User Story:** As a framework developer, I want permission strings to be generated automatically from the model registry, so that adding a new model automatically makes its CRUD permissions available without any manual registration.

#### Acceptance Criteria

1. THE Permission_Generator SHALL expose a `generatePermissions(models: Map<string, Model<PgTable>>)` function that accepts the Model_Registry and returns an `ac` statement object.
2. WHEN `generatePermissions` is called with a non-empty Model_Registry, THE Permission_Generator SHALL produce exactly four Permission_Strings per model: `<modelName>:create`, `<modelName>:read`, `<modelName>:update`, and `<modelName>:delete`.
3. WHEN `generatePermissions` is called with an empty Model_Registry, THE Permission_Generator SHALL return an empty statement object `{}`.
4. THE Permission_Generator SHALL produce Permission_Strings using the Drizzle table name (the key used in `appClient.models`) as the resource name.
5. FOR ALL valid Model_Registry inputs, calling `generatePermissions` twice with the same input SHALL produce structurally equivalent statement objects (determinism / idempotence).
6. FOR ALL Permission_Strings produced by `generatePermissions`, splitting the string on `:` SHALL yield exactly two parts where the first part is a key present in the input Model_Registry and the second part is one of `create`, `read`, `update`, `delete` (round-trip property).

---

### Requirement 2: AC Instance Construction

**User Story:** As a framework developer, I want a single `createAccessControl` instance built from the generated permissions, so that Better Auth's native permission engine can validate all model operations.

#### Acceptance Criteria

1. THE Permission_Generator SHALL expose a `buildAc(models: Map<string, Model<PgTable>>)` function that calls `createAccessControl` from `better-auth/plugins/access` with the statement produced by `generatePermissions`.
2. WHEN `buildAc` is called, THE AC_Instance SHALL contain a resource key for every model name present in the Model_Registry.
3. WHEN `buildAc` is called, THE AC_Instance SHALL contain exactly the actions `["create", "read", "update", "delete"]` for each resource key.
4. THE AC_Instance produced by `buildAc` SHALL be usable as the `ac` option passed to the `organization()` plugin without type errors.

---

### Requirement 3: Auth Server Configuration

**User Story:** As a framework developer, I want the Better Auth server instance to use the `organization` plugin with dynamic access control enabled, so that roles and their permission assignments are stored in and resolved from the database at runtime.

#### Acceptance Criteria

1. THE Auth_Server SHALL include the `organization()` plugin configured with the AC_Instance produced by `buildAc` and `dynamicAccessControl: { enabled: true }`.
2. THE Auth_Server SHALL include the `admin()` plugin.
3. THE Auth_Server SHALL include the `tanstackStartCookies()` plugin.
4. WHEN the Auth_Server is initialised, THE Auth_Server SHALL expose `auth.api.hasPermission` for server-side permission checks.
5. WHEN the Auth_Server is initialised, THE Auth_Server SHALL expose `auth.api.createOrgRole` for creating Dynamic_Roles at runtime.
6. IF the Model_Registry is empty at the time `createAuth` is called, THEN THE Auth_Server SHALL still initialise successfully with an empty AC_Instance and all three plugins present.

---

### Requirement 4: Auth Client Configuration

**User Story:** As a frontend developer, I want the Better Auth client to include the `organizationClient` plugin with dynamic access control enabled, so that client-side permission helpers are available.

#### Acceptance Criteria

1. THE Auth_Client SHALL be created with `organizationClient()` from `better-auth/client/plugins` included in its plugin list.
2. THE Auth_Client SHALL be created with `dynamicAccessControl: { enabled: true }` passed to `organizationClient()`.
3. WHEN the Auth_Client is initialised, THE Auth_Client SHALL expose `authClient.organization.hasPermission` for client-side permission checks.
4. THE Auth_Client SHALL NOT use `checkRolePermission` for dynamic role checks, as that function does not resolve dynamic roles.

---

### Requirement 5: Permission Guard Replacement

**User Story:** As a framework developer, I want `permission-guard.ts` to delegate permission evaluation to Better Auth's native `auth.api.hasPermission`, so that the custom DB role-lookup logic is eliminated and all permission state lives in Better Auth's own tables.

#### Acceptance Criteria

1. THE Permission_Guard SHALL accept a Target_String in the format `<modelName>:<operation>` and parse it into a resource name and an action name.
2. WHEN a Target_String is provided, THE Permission_Guard SHALL call `auth.api.hasPermission` with a `permissions` body of `{ [resourceName]: [actionName] }` and the session headers.
3. WHEN `auth.api.hasPermission` returns `{ success: true }`, THE Permission_Guard SHALL return `true`.
4. WHEN `auth.api.hasPermission` returns `{ success: false }`, THE Permission_Guard SHALL return `false`.
5. IF the Target_String references a model name not present in the Model_Registry, THEN THE Permission_Guard SHALL throw an `Error` with a message identifying the unknown model.
6. IF the Target_String does not contain a `:` separator, THEN THE Permission_Guard SHALL throw an `Error` with a message indicating the invalid format.
7. THE Permission_Guard SHALL preserve the existing function signature `can(session, target, auth)` so that all existing call sites remain compatible without modification.
8. THE Permission_Guard SHALL NOT query the `rolesTable` or `userRolesTable` directly; all permission resolution SHALL be delegated to the Auth_Server.

---

### Requirement 6: Removal of Custom Schema Tables

**User Story:** As a framework developer, I want the custom `rolesTable` and `userRolesTable` Drizzle tables to be removed from the core schema, so that the database schema is simplified and all role/permission data is managed exclusively by Better Auth's `organizationRole` and `member` tables.

#### Acceptance Criteria

1. THE Permission_Generator SHALL NOT depend on `rolesTable` or `userRolesTable` from `@tanstack-use/core/schema`.
2. THE Permission_Guard SHALL NOT import or reference `rolesTable` or `userRolesTable`.
3. WHEN the `createPermissionsAdapter` function is no longer needed, THE server entry point (`packages/tanstack-use-permissions/src/server.ts`) SHALL NOT export it.
4. THE public API (`packages/tanstack-use-permissions/src/index.ts`) SHALL continue to export `can`, `AuthorizationError`, and `createAuthRoute` without breaking changes.

---

### Requirement 7: Session and Cookie Handling

**User Story:** As a developer, I want the session to be correctly propagated through TanStack Start's cookie mechanism, so that `auth.api.hasPermission` can resolve the active organization and member role from the session on every request.

#### Acceptance Criteria

1. WHILE a user is authenticated, THE Auth_Server SHALL resolve the active organization from `session.activeOrganizationId` when evaluating `hasPermission`.
2. WHEN `tanstackStartCookies()` is active, THE Auth_Server SHALL read session cookies from TanStack Start's request context without requiring manual header forwarding in the Permission_Guard.
3. THE Permission_Guard SHALL pass the request `headers` object to `auth.api.hasPermission` so that the session cookie is available for resolution.
4. IF `session.activeOrganizationId` is `null` or absent, THEN THE Auth_Server SHALL return `{ success: false }` from `hasPermission`, and THE Permission_Guard SHALL return `false`.

---

### Requirement 8: Backward Compatibility of `defineModel` Permissions Config

**User Story:** As an application developer, I want to continue defining permissions in `defineModel` using role name strings, so that existing model definitions do not need to be rewritten when the permission backend changes.

#### Acceptance Criteria

1. THE `PermissionsDef` type in `packages/tanstack-use-core/src/types.ts` SHALL continue to accept `string[]` for `read`, `create`, `update`, and `delete` fields.
2. WHERE a model's `permissions` block is defined, THE Permission_Guard SHALL use the role names listed there as the expected Dynamic_Role names when checking `hasPermission`.
3. WHERE a model's `permissions` block is absent or empty for an operation, THE Permission_Guard SHALL return `true` without calling `hasPermission` (unrestricted access).
4. THE `defineModel` function signature SHALL NOT change.
