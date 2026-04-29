# Requirements Document

## Introduction

`tanstack-use` is a TypeScript framework where developers define one model per file using `defineModel()` and the system generates UI pages (list, detail, create) using TanStack Router + TanStack Query, with group-based permissions via Better Auth and file upload with access control. The framework's core principle is **minimal code** — use Drizzle as-is, use Better Auth as-is, and only add what those libraries cannot provide: the UI config layer and the TanStack renderer.

The framework also integrates TanStack Table for rich list views, TanStack Form for validated create/edit forms, TanStack Pacer for debounced search inputs, and TanStack AI for an auto-generated AI chatbot that understands every registered model, page, and permitted action.

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
- **TanStack_Renderer**: The UI module that reads `UIConfig` directly to render list, detail, and create pages using TanStack Router + TanStack Query + TanStack Table + TanStack Form.
- **AI_Agent**: The auto-generated chatbot powered by TanStack AI that derives its knowledge of pages, models, and actions from the App registry at startup.

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
2. WHEN `defineApp()` is called, THE Engine SHALL register all provided Models in a global registry accessible to the TanStack_Renderer, Permission_Guard, and AI_Agent.
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

**User Story:** As a developer, I want the framework to generate list, detail, and create pages using TanStack Router, TanStack Query, TanStack Table, and TanStack Form based on the UIConfig, so that I get a fully functional UI without writing page components manually.

#### Acceptance Criteria

1. THE TanStack_Renderer SHALL generate a list page for each Model where `ui.layout.list` is defined, displaying the fields specified in that array using TanStack Table for column management, sorting, and filtering.
2. THE TanStack_Renderer SHALL generate a detail page for each Model where `ui.layout.detail` is defined, rendering tabs and rows as specified.
3. THE TanStack_Renderer SHALL generate a create page for each Model where `ui.layout.create` is defined, rendering a validated form using TanStack Form with all non-computed fields listed in that array.
4. WHEN a field declares a `format` function in `ui.fields`, THE TanStack_Renderer SHALL call `format(record)` — passing the full typed record — before rendering in list and detail views.
5. WHEN a detail layout defines multiple tabs, THE TanStack_Renderer SHALL render a tabbed interface where each tab contains its declared rows.
6. WHEN a row contains multiple field references, THE TanStack_Renderer SHALL render those fields horizontally side by side.
7. WHEN a `client.onSubmit` hook is defined on a Model, THE TanStack_Renderer SHALL invoke the hook with the full typed record before submitting the create or update request.

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

### Requirement 9: Field Labels and i18n

**User Story:** As a developer, I want to provide a label function on each field so that the rendered UI displays the correct text, including localized text when using an i18n library like Paraglide JS.

#### Acceptance Criteria

1. THE Engine SHALL support a `label` property on `UIFieldDef` typed as `() => string` — a zero-argument function that returns the display string.
2. WHEN `label` is defined on a field, THE TanStack_Renderer SHALL call `label()` on every render and use the returned string as the field label.
3. WHEN `label` is absent on a field, THE TanStack_Renderer SHALL fall back to the field key name as the label.
4. THE `label` function SHALL be called on every render so that locale switches (e.g. via Paraglide's reactive `languageTag()`) are automatically reflected without additional wiring.
5. THE Engine SHALL NOT provide a `translations` config block, locale key mapping, or adapter setup — i18n is handled entirely by the function passed as `label`.

---

### Requirement 10: Test Coverage

**User Story:** As a framework author, I want every enforcement rule and rendering behavior to have corresponding tests, so that no feature is considered complete without verified, automated test coverage.

#### Acceptance Criteria

1. THE Engine SHALL include tests that verify layout field references are validated against the Drizzle table's column keys and declared computed field keys.
2. THE Engine SHALL include tests that verify computed fields are excluded from create/edit form inputs.
3. THE Engine SHALL include tests that verify `can(session, "ModelName.operation")` returns `false` for a member with no matching group and `true` for a member with a matching group.
4. THE Engine SHALL include tests that verify file upload is rejected when the member's groups are not listed in `fileAccess` and accepted when they are.
5. THE Engine SHALL include tests that verify no list/detail/create page is generated when the corresponding `ui.layout` section is absent.
6. THE Engine SHALL include tests that verify the `label` function is called and its return value used as the field label, and that the field key name is used when `label` is absent.
7. THE Engine SHALL include tests that verify `compute` and `format` functions receive the full typed record.
8. THE Engine SHALL include tests that verify `beforeCreate` aborting prevents record persistence, and `afterCreate` errors do not roll back persisted records.
9. FOR ALL valid `UIConfig` objects, the `format` function receiving the full record SHALL produce the same output as calling `format` with a manually constructed equivalent record (round-trip property).
10. FOR ALL valid permission configs, `can()` SHALL return `true` if and only if the member's groups intersect the allowed groups (or the allowed groups list is empty).
11. THE Engine SHALL include tests that verify search debouncing fires the query only after the configured delay, not on every keystroke.
12. THE Engine SHALL include tests that verify `buildAITools()` produces one tool per permitted operation per model, and that tools respect the model's permission config.

---

### Requirement 11: Rich List Views with TanStack Table

**User Story:** As a developer, I want the generated list page to support sorting, filtering, and pagination out of the box, so that users can navigate large datasets without any additional configuration.

#### Acceptance Criteria

1. THE TanStack_Renderer SHALL use TanStack Table (`@tanstack/react-table`) to render the list page, with column definitions derived from `ui.layout.list`.
2. THE list page SHALL support client-side column sorting by clicking column headers; sort state SHALL be reflected in the URL via TanStack Router search params.
3. THE list page SHALL render a search input above the table; user input SHALL be debounced using TanStack Pacer (`@tanstack/pacer`) before triggering a filtered query.
4. THE debounce delay for the search input SHALL default to 300 ms and SHALL be configurable per-model via `ui.layout.listOptions.searchDebounceMs`.
5. THE list page SHALL support pagination; page and page size SHALL be reflected in the URL via TanStack Router search params.
6. WHEN `ui.layout.list` is absent, THE Engine SHALL generate no list page and no TanStack Table instance for that model.
7. THE column definitions passed to TanStack Table SHALL use `resolveLabel` for header text, so i18n label functions are respected.

---

### Requirement 12: Validated Forms with TanStack Form

**User Story:** As a developer, I want the generated create and edit pages to use TanStack Form for field-level validation and dirty-state tracking, so that users get immediate feedback without any additional form wiring.

#### Acceptance Criteria

1. THE TanStack_Renderer SHALL use TanStack Form (`@tanstack/react-form`) to render create and edit forms, with fields derived from `ui.layout.create` (excluding computed fields).
2. WHEN a field declares a `validate` function in `ui.fields`, THE Engine SHALL register it as a TanStack Form field-level validator; validation SHALL run on change and on blur.
3. WHEN a form field fails validation, THE TanStack_Renderer SHALL display the validation error message below the field.
4. THE submit button SHALL be disabled while the form is submitting or while any field has a validation error.
5. WHEN `client.onSubmit` is defined, THE Engine SHALL call it with the validated record values before POSTing to the API.
6. THE form SHALL track dirty state; navigating away from a dirty form SHALL prompt the user for confirmation via TanStack Router's `onBeforeLoad` guard.

---

### Requirement 13: AI Chatbot with TanStack AI

**User Story:** As a developer, I want the framework to auto-generate an AI chatbot that knows every registered model, page, and permitted action, so that end users can interact with the application using natural language without any manual tool configuration.

#### Acceptance Criteria

1. THE Engine SHALL export a `buildAITools(app, session)` function from a new `tanstack-use-ai` package that derives AI tool definitions from `app.models` using TanStack AI (`@tanstack/ai`).
2. FOR EACH model in the App registry, `buildAITools` SHALL generate tools for each operation (`list`, `create`, `update`, `delete`) that the session's member is permitted to perform, as determined by `can()`.
3. THE Engine SHALL export a `buildSystemPrompt(app)` function that generates a natural-language description of all registered models, their fields, and their permitted operations for use as the AI system prompt.
4. WHEN the AI agent calls a generated tool, THE Engine SHALL execute the corresponding API operation (e.g. `GET /api/{tableName}`, `POST /api/{tableName}`) and return the result to the agent.
5. WHEN the AI agent navigates to a page as part of a tool response, THE Engine SHALL call TanStack Router's `navigate()` to perform the navigation programmatically.
6. THE AI provider adapter SHALL be configurable by the developer — the framework SHALL NOT hard-code a specific LLM provider; developers pass a TanStack AI adapter (e.g. `openaiText("gpt-4o")`) to `defineApp()` or to the chatbot component directly.
7. THE chatbot component SHALL stream responses using TanStack AI's built-in streaming support.
8. WHEN a tool call would perform an operation the session's member is not permitted to perform, THE Engine SHALL reject the tool call and return an error message to the AI agent rather than throwing an unhandled exception.

---
