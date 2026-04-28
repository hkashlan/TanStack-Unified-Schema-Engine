# Requirements Document

## Introduction

`tanstack-use` is a TypeScript framework where developers define one model per file using `defineModel()` and the system generates UI pages (list, detail, create) using TanStack Router + TanStack Query, with group-based permissions via Better Auth and file upload with access control. The framework's core principle is **minimal code** — use Drizzle as-is, use Better Auth as-is, and only add what those libraries cannot provide: the UI config layer and the TanStack renderer.

## Glossary

- **Engine**: The `tanstack-use` framework as a whole.
- **Model**: A developer-defined schema unit created via `defineModel()`, containing a Drizzle table, UI config, permissions, and lifecycle hooks.
- **App**: The global registry created via `defineApp()`, aggregating all Models and a Better Auth instance.
- **Field**: A typed data attribute declared in a Drizzle table passed to `defineModel()`.
- **Computed_Field**: A read-only, derived UI field declared inside `ui.computedFields` with a `dependsOn` array and a `compute` function.
- **Layout**: The UI structure declared inside `ui.layout`, specifying which fields appear in list, detail, and create views. Page existence is determined solely by whether the corresponding layout section is defined.
- **Tab**: A named grouping of rows within a detail layout.
- **Row**: An array of field references representing a horizontal group within a Tab or layout section.
- **Permission**: A role-based access rule attached to a Model, controlling read, create, update, and delete operations using Better Auth organization group names.
- **Member**: An authenticated user's identity within the App, linked to one or more Groups via Better Auth's organization plugin.
- **Group**: A named collection of Members used for permission evaluation, managed entirely by Better Auth's organization plugin.
- **File_Model**: A file helper created via `fileModel()` that declares storage config and `fileAccess` groups. It produces a text column (storing the file path) for use in a Drizzle table.
- **Permission_Guard**: The runtime enforcement layer that evaluates `can()` using Better Auth group memberships.
- **TanStack_Renderer**: The UI module that reads `UIConfig` directly to render list, detail, and create pages using TanStack Router + TanStack Query.

---

## Requirements

### Requirement 1: Model Definition

**User Story:** As a developer, I want to define a model by passing a Drizzle table and a UI config to `defineModel()`, so that the Drizzle table is the schema and the UI config is a lightweight typed overlay.

#### Acceptance Criteria

1. THE Engine SHALL export a `defineModel()` function that accepts a Drizzle `PgTable` as its first argument and a `UIConfig` object as its second argument.
2. WHEN `defineModel()` is called with a valid Drizzle table and UI config, THE Engine SHALL return a typed Model object that can be registered with `defineApp()`.
3. IF `defineModel()` is called without a Drizzle table, THEN THE Engine SHALL produce a compile-time type error.
4. THE Engine SHALL infer the record type directly from the Drizzle table's column definitions — no separate field type mapping is needed.
5. WHEN `ui.layout` is entirely absent from a Model definition, THE Engine SHALL generate NO pages for that Model.
6. WHEN `ui.layout.list` is defined, THE Engine SHALL enable the list page for that Model; WHEN `ui.layout.list` is absent, THE Engine SHALL generate no list page.
7. WHEN `ui.layout.detail` is defined, THE Engine SHALL enable the detail page for that Model; WHEN `ui.layout.detail` is absent, THE Engine SHALL generate no detail page.
8. WHEN `ui.layout.create` is defined, THE Engine SHALL enable the create page for that Model; WHEN `ui.layout.create` is absent, THE Engine SHALL generate no create page.

---

### Requirement 2: Type-Safe UI Layout Validation

**User Story:** As a developer, I want invalid field references in my UI layout to fail at compile time, so that I cannot accidentally reference fields that do not exist on the model.

#### Acceptance Criteria

1. THE Engine SHALL validate at compile time that every field reference in `ui.layout.list` is either a column key from the Drizzle table or a declared `computedField` key.
2. THE Engine SHALL validate at compile time that every field reference in `ui.layout.detail` tabs and rows is either a column key from the Drizzle table or a declared `computedField` key.
3. IF a layout references a name that is not a column key and not a `computedField` key, THEN THE Engine SHALL produce a compile-time type error identifying the invalid reference.
4. THE Engine SHALL validate at compile time that every `dependsOn` entry in a `computedField` references a column key from the Drizzle table.
5. IF a `dependsOn` entry references a name that is not a column key, THEN THE Engine SHALL produce a compile-time type error.

---

### Requirement 3: Computed Fields

**User Story:** As a developer, I want to define computed fields in the UI config that derive their value from one or more base fields, so that I can display derived data (e.g., full name) without storing it in the database.

#### Acceptance Criteria

1. THE Engine SHALL support computed fields declared inside `ui.computedFields` with the properties `dependsOn` (non-empty array of column keys) and `compute` (function receiving the full typed record).
2. THE Engine SHALL mark all computed fields as read-only and exclude them from all form inputs in create and edit views.
3. WHEN a computed field is included in a list or detail layout, THE TanStack_Renderer SHALL display the result of calling `compute(record)` with the full typed record.
4. IF a computed field's `dependsOn` array is empty, THEN THE Engine SHALL produce a compile-time type error.
5. THE `compute` function SHALL receive the full typed record (inferred from the Drizzle table), and the optional `format` function SHALL also receive the full typed record.

---

### Requirement 4: App Definition and Model Registry

**User Story:** As a developer, I want to register all models and a Better Auth instance in a single `defineApp()` call, so that the framework has a global registry to coordinate UI generation and permissions.

#### Acceptance Criteria

1. THE Engine SHALL export a `defineApp()` function that accepts a configuration object containing `models` (array of Model objects) and `auth` (a pre-configured Better Auth instance).
2. WHEN `defineApp()` is called, THE Engine SHALL register all provided Models in a global registry accessible to the TanStack_Renderer and Permission_Guard.
3. IF `defineApp()` is called with two Models that share the same table name, THEN THE Engine SHALL throw a runtime error identifying the duplicate.
4. THE `auth` property SHALL accept a Better Auth instance created via `betterAuth()` with the `organization` plugin enabled.
5. THE Engine SHALL NOT generate any custom auth entity schema — all user, member, and group data is managed entirely by the provided Better Auth instance.

---

### Requirement 5: Permission System

**User Story:** As a developer, I want to define group-based permissions on each model and have them enforced at the page and API levels, so that unauthorized users cannot access or modify protected data.

#### Acceptance Criteria

1. THE Engine SHALL support a `permissions` config on each Model with `read`, `create`, `update`, and `delete` keys, each accepting an array of Better Auth organization group names.
2. THE Permission_Guard SHALL expose a `can(session, "ModelName.operation")` function that returns `true` if the session's member belongs to at least one group listed in the Model's permission rule for that operation.
3. WHEN a permission array is empty or absent, THE Permission_Guard SHALL treat the operation as unrestricted (open to all authenticated members).
4. WHEN a member attempts to access a page for a Model and `can()` returns `false`, THE TanStack_Renderer SHALL redirect to an unauthorized page.
5. WHEN a member attempts a create, update, or delete operation and `can()` returns `false`, THE Permission_Guard SHALL throw an authorization error (HTTP 403).
6. THE Permission_Guard SHALL resolve group memberships by calling the Better Auth organization plugin APIs at request time — the framework stores no group data itself.

---

### Requirement 6: File Fields

**User Story:** As a developer, I want to declare file fields using a `fileModel()` helper, so that file storage and access control are handled by the framework with minimal boilerplate.

#### Acceptance Criteria

1. THE Engine SHALL export a `fileModel()` helper that accepts a configuration object with `storage` (a storage adapter) and `fileAccess` (array of Better Auth group names permitted to upload and delete).
2. THE `fileModel()` helper SHALL produce a text column (storing the file path) suitable for use directly in a Drizzle table definition.
3. WHEN a member attempts to upload a file and does not belong to any group listed in `fileAccess`, THE Permission_Guard SHALL reject the upload with an authorization error.
4. WHEN a member attempts to delete a file and does not belong to any group listed in `fileAccess`, THE Permission_Guard SHALL reject the deletion with an authorization error.
5. WHEN a member with valid access uploads a file, THE Engine SHALL store the file via the configured storage adapter and return the file path for the text column.
6. WHEN a file field is rendered in a detail or create view, THE TanStack_Renderer SHALL display a file upload input with preview capability.
7. WHEN a file field is rendered for a member who lacks upload access, THE TanStack_Renderer SHALL display the file as read-only without upload or delete controls.

---

### Requirement 7: TanStack UI Rendering

**User Story:** As a developer, I want the framework to generate list, detail, and create pages using TanStack Router and TanStack Query based on the UIConfig, so that I get a fully functional UI without writing page components manually.

#### Acceptance Criteria

1. THE TanStack_Renderer SHALL generate a list page for each Model where `ui.layout.list` is defined, displaying the fields specified in that array.
2. THE TanStack_Renderer SHALL generate a detail page for each Model where `ui.layout.detail` is defined, rendering tabs and rows as specified.
3. THE TanStack_Renderer SHALL generate a create page for each Model where `ui.layout.create` is defined, rendering a form with all non-computed fields listed in that array.
4. WHEN a field declares a `format` function in `ui.fields`, THE TanStack_Renderer SHALL call `format(record)` — passing the full typed record — before rendering in list and detail views.
5. WHEN a detail layout defines multiple tabs, THE TanStack_Renderer SHALL render a tabbed interface where each tab contains its declared rows.
6. WHEN a row contains multiple field references, THE TanStack_Renderer SHALL render those fields horizontally side by side.
7. WHEN a `client.onSubmit` hook is defined on a Model, THE TanStack_Renderer SHALL invoke the hook with the full typed record before submitting the create or update request.
8. WHEN an active locale is set, THE TanStack_Renderer SHALL resolve field labels from the Model's `translations` config for that locale before rendering.

---

### Requirement 8: Server Lifecycle Hooks

**User Story:** As a developer, I want to define `beforeCreate`, `afterCreate`, `beforeUpdate`, and `afterUpdate` hooks on a model, so that I can execute custom server-side logic around record persistence.

#### Acceptance Criteria

1. THE Engine SHALL support `server.beforeCreate`, `server.afterCreate`, `server.beforeUpdate`, and `server.afterUpdate` async functions on a Model, each receiving a context object with the full typed record and the Better Auth session.
2. WHEN `server.beforeCreate` throws an error, THE Engine SHALL abort the create operation and propagate the error without persisting the record.
3. WHEN `server.afterCreate` throws an error, THE Engine SHALL log the error and NOT roll back the already-persisted record.
4. THE Engine SHALL invoke hooks in order: `beforeCreate` → persist → `afterCreate` (and equivalently for update).
5. THE hook context `record` SHALL be typed as the full inferred record type from the Drizzle table.
6. THE hook context SHALL include the Better Auth session object (typed as `BetterAuthSession`).

---

### Requirement 9: Translations

**User Story:** As a developer, I want to provide translations for field labels and page titles in my model definition, so that the rendered UI displays localized text based on the active locale.

#### Acceptance Criteria

1. THE Engine SHALL support a `translations` property on `UIConfig` that accepts a `TranslationConfig` object with `fieldLabels`, `pageTitle`, and `messages` sub-keys.
2. WHEN an active locale is set, THE TanStack_Renderer SHALL use the corresponding entry from `translations` to resolve field labels and page titles.
3. WHEN a field key is present in `translations.fieldLabels`, THE TanStack_Renderer SHALL display that string as the field label.
4. WHEN a field key is absent from `translations.fieldLabels`, THE TanStack_Renderer SHALL fall back to the field key name as the label.
5. WHEN no `translations` config is provided, THE TanStack_Renderer SHALL use field key names as labels.

---

### Requirement 10: Test Coverage

**User Story:** As a framework author, I want every enforcement rule and rendering behavior to have corresponding tests, so that no feature is considered complete without verified, automated test coverage.

#### Acceptance Criteria

1. THE Engine SHALL include tests that verify layout field references are validated against the Drizzle table's column keys and declared computed field keys.
2. THE Engine SHALL include tests that verify computed fields are excluded from create/edit form inputs.
3. THE Engine SHALL include tests that verify `can(session, "ModelName.operation")` returns `false` for a member with no matching group and `true` for a member with a matching group.
4. THE Engine SHALL include tests that verify file upload is rejected when the member's groups are not listed in `fileAccess` and accepted when they are.
5. THE Engine SHALL include tests that verify no list/detail/create page is generated when the corresponding `ui.layout` section is absent.
6. THE Engine SHALL include tests that verify translated field labels are rendered when an active locale matches a `translations` entry.
7. THE Engine SHALL include tests that verify `compute` and `format` functions receive the full typed record.
8. THE Engine SHALL include tests that verify `beforeCreate` aborting prevents record persistence, and `afterCreate` errors do not roll back persisted records.
9. FOR ALL valid `UIConfig` objects, the `format` function receiving the full record SHALL produce the same output as calling `format` with a manually constructed equivalent record (round-trip property).
10. FOR ALL valid permission configs, `can()` SHALL return `true` if and only if the member's groups intersect the allowed groups (or the allowed groups list is empty).
