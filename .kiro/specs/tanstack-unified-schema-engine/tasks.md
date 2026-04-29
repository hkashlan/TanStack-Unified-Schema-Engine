# Implementation Plan: tanstack-use

## Overview

Implement the `tanstack-use` meta-framework as a TypeScript monorepo with five packages: `tanstack-use-core`, `tanstack-use-permissions`, `tanstack-use-files`, `tanstack-use-ui`, and `tanstack-use-ai`. Tasks follow TDD order — types and tests are established before or alongside each feature, with property-based tests (fast-check) and unit tests (Vitest) throughout.

## Tasks

- [x] 1. Bootstrap monorepo and shared tooling
  - Initialize a pnpm workspace with `pnpm-workspace.yaml` listing all four packages
  - Add root `package.json` with `vitest`, `typescript`, `fast-check`, `tsd`, `@types/node` as dev dependencies
  - Add root `tsconfig.base.json` with strict mode, `moduleResolution: bundler`, `target: ES2022`
  - Create `packages/tanstack-use-core`, `packages/tanstack-use-permissions`, `packages/tanstack-use-files`, `packages/tanstack-use-ui` directories each with a `package.json` and `tsconfig.json` extending the base
  - Add a root `vitest.config.ts` that discovers tests across all packages
  - _Requirements: 10.1_

- [-] 2. Define core TypeScript types in `tanstack-use-core`
  - [x] 2.1 Create `packages/tanstack-use-core/src/types.ts` with all exported interfaces and type aliases
    - Export `InferRecord<T>`, `AllFieldKeys<T, TComputed>`, `ComputedFieldDef<T>`, `UIFieldDef<T>`, `TabDef`, `LayoutDef`, `ListOptions`, `PermissionsDef`, `ServerHooks<T>`, `ClientHooks<T>`, `UIConfig<T>`, `Model<T>`, `App`
    - Use non-empty tuple `[keyof T["_"]["columns"], ...(keyof T["_"]["columns"])[]]` for `ComputedFieldDef.dependsOn`
    - Add `validate?: (value: unknown) => string | undefined` to `UIFieldDef`
    - Add `listOptions?: ListOptions` to `LayoutDef` with `searchDebounceMs?: number`
    - _Requirements: 1.1, 1.4, 2.4, 3.1, 3.4, 8.1, 11.4, 12.2_

  - [x] 2.2 Write compile-time type tests for core types using `tsd`
    - Verify `InferRecord` resolves correctly from a sample `PgTable`
    - Verify `AllFieldKeys` includes both column keys and computed field keys
    - Verify empty `dependsOn` array produces a type error
    - Verify layout referencing a non-existent key produces a type error
    - _Requirements: 2.3, 2.5, 3.4, 10.1_

- [x] 3. Implement `defineModel()` in `tanstack-use-core`
  - [x] 3.1 Create `packages/tanstack-use-core/src/define-model.ts`
    - Implement `defineModel<T extends PgTable>(table: T, ui: UIConfig<T>): Model<T>`
    - Return `{ _tag: "Model", table, ui }`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Write unit tests for `defineModel()`
    - Test that a valid table + UIConfig returns a Model with `_tag: "Model"`
    - Test that `model.table` and `model.ui` are the exact objects passed in
    - Test that a model with no `ui.layout` is valid (no pages implied at this layer)
    - _Requirements: 1.2, 1.5, 10.1_

  - [x] 3.3 Write property test for layout field references (Property 1)
    - **Property 1: Layout field references are a subset of valid keys**
    - Generate arbitrary column maps and UIConfig layouts; assert every referenced field name is either a column key or a computed field key
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - _Requirements: 10.1_

  - [x] 3.4 Write property test for computed field dependsOn (Property 2)
    - **Property 2: Computed field dependsOn references are valid column keys**
    - Generate arbitrary column maps and computed field definitions; assert every `dependsOn` entry is a column key
    - **Validates: Requirements 2.4, 2.5**
    - _Requirements: 10.1_

- [x] 4. Implement `defineApp()` in `tanstack-use-core`
  - [x] 4.1 Create `packages/tanstack-use-core/src/define-app.ts`
    - Implement `defineApp(config: AppConfig): App`
    - Build a `Map<string, Model<any>>` keyed by `table[Symbol.for("drizzle:Name")]`
    - Throw `Error("Duplicate model: <name>")` on duplicate table names
    - Return `{ _tag: "App", models, auth }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 Write unit tests for `defineApp()`
    - Test that models are registered in the map keyed by table name
    - Test that duplicate table names throw the expected error
    - Test that the `auth` property is stored as-is on the returned App
    - _Requirements: 4.2, 4.3, 10.1_

- [x] 5. Create `packages/tanstack-use-core/src/index.ts` barrel export
  - Re-export `defineModel`, `defineApp`, and all types from `types.ts`
  - _Requirements: 1.1, 4.1_

- [x] 6. Checkpoint — core package baseline
  - Ensure all tests in `tanstack-use-core` pass, ask the user if questions arise.

- [x] 7. Implement `can()` in `tanstack-use-permissions`
  - [x] 7.1 Create `packages/tanstack-use-permissions/src/permission-guard.ts`
    - Implement `can(session, target, app): Promise<boolean>`
    - Parse `target` as `"ModelName.operation"`; throw `Error("Unknown model: <name>")` if not found
    - Return `true` when `allowedGroups` is empty or absent
    - Call `app.auth.api.getActiveMemberGroups(session)` and check intersection
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 7.2 Create `packages/tanstack-use-permissions/src/authorization-error.ts`
    - Export `class AuthorizationError extends Error` with HTTP status 403
    - _Requirements: 5.5_

  - [x] 7.3 Write unit tests for `can()`
    - Test returns `false` for a member with no matching group
    - Test returns `true` for a member with a matching group
    - Test returns `true` when the permission array is empty
    - Test throws `Error("Unknown model: ...")` for an unregistered model name
    - _Requirements: 5.2, 5.3, 10.3_

  - [x] 7.4 Write property test for permission evaluation (Property 4)
    - **Property 4: Permission evaluation is correct for all group combinations**
    - Generate random allowed-group lists and member-group lists; assert `can()` result equals `allowedGroups.length === 0 || memberGroups.some(g => allowedGroups.includes(g))`
    - **Validates: Requirements 5.2, 5.3**
    - _Requirements: 10.10_

- [x] 8. Create `packages/tanstack-use-permissions/src/index.ts` barrel export
  - Re-export `can` and `AuthorizationError`
  - _Requirements: 5.2_

- [x] 9. Checkpoint — permissions package
  - Ensure all tests in `tanstack-use-permissions` pass, ask the user if questions arise.

- [x] 10. Implement storage adapters in `tanstack-use-files`
  - [x] 10.1 Create `packages/tanstack-use-files/src/storage-adapter.ts`
    - Define and export `StorageAdapter` interface with `store(file: File): Promise<string>` and `delete(path: string): Promise<void>`
    - Implement `localDisk(options?: { dir?: string }): StorageAdapter` — writes to local filesystem, returns relative path
    - Implement `s3(options: { bucket: string; region: string }): StorageAdapter` — uploads to S3, returns S3 key
    - _Requirements: 6.1, 6.5_

  - [x] 10.2 Write unit tests for storage adapters
    - Test `localDisk` stores a file and returns a non-empty path string
    - Test `localDisk` deletes a previously stored file
    - Test `s3` adapter interface contract (mock AWS SDK)
    - _Requirements: 6.5, 10.4_

- [x] 11. Implement `fileModel()` and file handlers in `tanstack-use-files`
  - [x] 11.1 Create `packages/tanstack-use-files/src/file-model.ts`
    - Implement `fileModel(config: FileModelConfig): FileModelColumn`
    - Return `{ column: text("file_path"), _config: config }` — a Drizzle text column
    - _Requirements: 6.1, 6.2_

  - [x] 11.2 Create `packages/tanstack-use-files/src/file-handler.ts`
    - Implement `handleUpload(req, app): Promise<string>`
    - Check `fileAccess` groups via `app.auth.api.getActiveMemberGroups`; throw `AuthorizationError` if not permitted
    - Call `storage.store(file)` and return the path
    - Implement `handleDelete(req, app): Promise<void>`
    - Check `fileAccess` groups; throw `AuthorizationError` if not permitted
    - Call `storage.delete(path)`
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 11.3 Write unit tests for `fileModel()` and file handlers
    - Test `fileModel()` returns an object with a `column` and `_config`
    - Test `handleUpload` rejects when member groups don't intersect `fileAccess`
    - Test `handleUpload` accepts and returns a path when groups intersect
    - Test `handleDelete` rejects when member groups don't intersect `fileAccess`
    - Test `handleDelete` accepts when groups intersect
    - _Requirements: 6.3, 6.4, 10.4_

  - [x] 11.4 Write property test for file upload access (Property 5)
    - **Property 5: File upload access is consistent with fileAccess config**
    - Generate random `fileAccess` arrays and member group arrays; assert upload is permitted iff `fileAccess` is empty OR groups intersect
    - **Validates: Requirements 6.3, 6.4**
    - _Requirements: 10.4_

- [x] 12. Create `packages/tanstack-use-files/src/index.ts` barrel export
  - Re-export `fileModel`, `localDisk`, `s3`, `handleUpload`, `handleDelete`, `StorageAdapter`, `FileModelConfig`, `FileModelColumn`
  - _Requirements: 6.1_

- [x] 13. Checkpoint — files package
  - Ensure all tests in `tanstack-use-files` pass, ask the user if questions arise.

- [x] 14. Implement server lifecycle hook execution in `tanstack-use-core`
  - [x] 14.1 Create `packages/tanstack-use-core/src/execute-hooks.ts`
    - Implement `executeCreate(model, record, session, db): Promise<InferRecord<T>>`
    - Call `beforeCreate` if defined; propagate any thrown error without writing to DB
    - Insert record via `db.insert(model.table).values(record).returning()`
    - Call `afterCreate` if defined; catch and log errors without rolling back
    - Implement `executeUpdate` with the same pattern using `beforeUpdate`/`afterUpdate`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 14.2 Write unit tests for server lifecycle hooks
    - Test `beforeCreate` throwing aborts the operation and no DB insert occurs
    - Test `afterCreate` throwing logs the error and does not roll back the persisted record
    - Test hooks receive `{ record, session }` with the correct types
    - Test execution order: `beforeCreate` → persist → `afterCreate`
    - _Requirements: 8.2, 8.3, 8.4, 10.8_

- [x] 15. Implement label resolution in `tanstack-use-ui`
  - [x] 15.1 Create `packages/tanstack-use-ui/src/label-resolver.ts`
    - Implement `resolveLabel(fieldName: string, model: Model<any>): string`
    - Call `model.ui.fields?.[fieldName]?.label?.()` if defined; fall back to `fieldName`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 15.2 Write unit tests for label resolution
    - Test `label` function is called and its return value used as the label
    - Test fallback to field key name when `label` is absent
    - Test fallback when the field has no entry in `fields` at all
    - Test that the function is re-evaluated on each call (reactive locale support)
    - _Requirements: 9.2, 9.3, 9.4, 10.6_

- [x] 16. Implement route generation in `tanstack-use-ui`
  - [x] 16.1 Create `packages/tanstack-use-ui/src/create-routes.ts`
    - Implement `createRoutes(app: App, rootRoute: AnyRootRoute): AnyRoute[]`
    - Also export `buildRouteDescriptors(app): RouteDescriptor[]` for testing without a router
    - Iterate `app.models`; for each model register list route if `ui.layout?.list` is defined, detail route if `ui.layout?.detail` is defined, create route if `ui.layout?.create` is defined
    - Use `model.table[Symbol.for("drizzle:Name")]` as the URL segment
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 7.1, 7.2, 7.3_

  - [x] 16.2 Write unit tests for route generation
    - Test no routes registered when `ui.layout` is entirely absent
    - Test only list route registered when only `ui.layout.list` is defined
    - Test all three routes registered when all layout sections are defined
    - Test `createRoutes` returns real TanStack Router route instances that can be added to a root route
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 10.5_

  - [x] 16.3 Write property test for page existence (Property 6)
    - **Property 6: Page existence matches layout presence**
    - Generate random UIConfig with present/absent layout sections; assert generated routes match exactly the defined sections
    - **Validates: Requirements 1.5, 1.6, 1.7, 1.8**
    - _Requirements: 10.5_

- [x] 17. Implement `ListPage` component with TanStack Table and TanStack Pacer
  - [x] 17.1 Install `@tanstack/react-table` and `@tanstack/pacer` in `tanstack-use-ui`
    - Add `@tanstack/react-table` and `@tanstack/pacer` as dependencies of `packages/tanstack-use-ui`
    - _Requirements: 11.1, 11.3_

  - [x] 17.2 Create `packages/tanstack-use-ui/src/components/ListPage.tsx`
    - Derive TanStack Table column definitions from `model.ui.layout.list`; use `resolveLabel` for header text
    - Use TanStack Query `useQuery` to fetch records from `GET /api/{tableName}`
    - Add a search `<input>` debounced via TanStack Pacer `useAsyncDebouncer` with delay from `model.ui.layout.listOptions?.searchDebounceMs ?? 300`
    - Pass debounced search term as a query param to the fetch function
    - Reflect sort state and pagination in URL via TanStack Router search params
    - For computed field cells: call `cf.format ? cf.format(row.original) : String(cf.compute(row.original))`
    - For regular field cells: call `uiField?.format ? uiField.format(row.original) : row.original[col]`
    - _Requirements: 7.1, 7.4, 3.3, 11.1, 11.2, 11.3, 11.5, 11.7_

  - [x] 17.3 Write unit tests for `ListPage`
    - Test that column headers match `resolveLabel` output for each field in `ui.layout.list`
    - Test that `format(record)` is called with the full record (not just the field value)
    - Test that computed field values are rendered via `compute(record)`
    - Test that the search input is rendered and wired to the debouncer
    - _Requirements: 7.4, 3.3, 11.7, 10.7_

  - [x] 17.4 Write property test for format/compute receiving full record (Property 3)
    - **Property 3: format and compute receive the full record**
    - Generate random records and format/compute functions; assert the value rendered equals calling the function with the full record object
    - **Validates: Requirements 3.5, 7.4**
    - _Requirements: 10.7, 10.9_

  - [x] 17.5 Write property test for search debounce (Property 9)
    - **Property 9: Search debounce fires exactly once per settled input**
    - Use fake timers; generate sequences of keystrokes within the debounce window; assert the query fires exactly once after the window expires
    - **Validates: Requirements 11.3, 11.4**
    - _Requirements: 10.11_

- [ ] 18. Implement `DetailPage` component in `tanstack-use-ui`
  - [ ] 18.1 Create `packages/tanstack-use-ui/src/components/DetailPage.tsx`
    - Use TanStack Query `useQuery` to fetch one record from `GET /api/{tableName}/$id`
    - Render tabs from `model.ui.layout.detail`; each tab renders its rows; each row renders fields horizontally via `<FieldDisplay>`
    - Implement `<FieldDisplay>` that resolves label and calls `format(record)` or `compute(record)` as appropriate
    - _Requirements: 7.2, 7.4, 7.5, 7.6_

  - [ ]* 18.2 Write unit tests for `DetailPage`
    - Test tabbed interface renders one tab per `layout.detail` entry
    - Test rows render fields side by side
    - Test `<FieldDisplay>` calls `format` with the full record
    - _Requirements: 7.5, 7.6, 10.7_

- [ ] 19. Implement `CreatePage` component with TanStack Form
  - [ ] 19.1 Install `@tanstack/react-form` in `tanstack-use-ui`
    - Add `@tanstack/react-form` as a dependency of `packages/tanstack-use-ui`
    - _Requirements: 12.1_

  - [ ] 19.2 Create `packages/tanstack-use-ui/src/components/CreatePage.tsx`
    - Filter `model.ui.layout.create` to exclude computed field keys
    - Use TanStack Form `useForm` with field validators from `ui.fields[fieldName]?.validate`
    - Validators run on change and on blur per field
    - Display validation error messages below each field
    - Disable the submit button while submitting or while any field has a validation error
    - Implement `handleSubmit`: if `model.ui.client?.onSubmit` is defined, call it with the validated record; then POST to `/api/{tableName}`
    - Add a dirty-state navigation guard via TanStack Router's `onBeforeLoad` that prompts the user before leaving an unsaved form
    - _Requirements: 7.3, 7.7, 3.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 19.3 Write unit tests for `CreatePage`
    - Test computed fields are excluded from the form field list
    - Test `onSubmit` hook is called with the full record before submission
    - Test the value submitted to the API is the return value of `onSubmit`, not the original record
    - Test that a field with a failing `validate` function shows an error message
    - Test that the submit button is disabled when a field has a validation error
    - _Requirements: 3.2, 7.7, 10.2, 10.7, 12.3, 12.4_

  - [ ]* 19.4 Write property test for onSubmit transformation (Property 7)
    - **Property 7: onSubmit transformation is applied before submission**
    - Generate random records and transform functions; assert the value POSTed equals `onSubmit(record)`
    - **Validates: Requirements 7.7**
    - _Requirements: 10.7_

- [ ] 20. Implement file field rendering in `tanstack-use-ui`
  - [ ] 20.1 Add file field detection to `<FieldInput>` and `<FieldDisplay>`
    - Detect file fields by checking if the column is produced by `fileModel()` (via `_config` presence)
    - In `<FieldDisplay>`: render a preview of the stored file path
    - In `<FieldInput>`: render a file upload input; call `handleUpload` on file selection; update the form value with the returned path
    - When the member lacks upload access (checked via `can()`), render the field as read-only without upload/delete controls
    - _Requirements: 6.6, 6.7_

  - [ ]* 20.2 Write unit tests for file field rendering
    - Test file upload input is rendered for members with access
    - Test read-only display is rendered for members without access
    - _Requirements: 6.6, 6.7_

- [ ] 21. Implement permission enforcement in `tanstack-use-ui`
  - [ ] 21.1 Add permission guard to route components
    - In each page component, call `can(session, "ModelName.operation", app)` on mount
    - If `can()` returns `false`, redirect to `/unauthorized` via TanStack Router
    - _Requirements: 5.4_

  - [ ]* 21.2 Write unit tests for permission enforcement in UI
    - Test that a page redirects to `/unauthorized` when `can()` returns `false`
    - Test that a page renders normally when `can()` returns `true`
    - _Requirements: 5.4, 10.3_

- [ ] 22. Create `packages/tanstack-use-ui/src/index.ts` barrel export
  - Re-export `createRoutes`, `buildRouteDescriptors`, `ListPage`, `DetailPage`, `CreatePage`, `FieldDisplay`, `FieldInput`
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 23. Checkpoint — UI package
  - Ensure all tests in `tanstack-use-ui` pass, ask the user if questions arise.

- [ ] 24. Bootstrap `tanstack-use-ai` package
  - [ ] 24.1 Create `packages/tanstack-use-ai` directory with `package.json` and `tsconfig.json`
    - Add `@tanstack/ai` as a dependency
    - Add `@tanstack-use/core` and `@tanstack-use/permissions` as workspace dependencies
    - _Requirements: 13.1_

  - [ ] 24.2 Implement `buildSystemPrompt(app)` in `packages/tanstack-use-ai/src/build-system-prompt.ts`
    - Iterate `app.models`; for each model describe its table name, field names, and which layout sections are defined
    - Return a natural-language string suitable for use as an AI system message
    - _Requirements: 13.3_

  - [ ] 24.3 Write unit tests for `buildSystemPrompt`
    - Test that the prompt mentions every registered model's table name
    - Test that the prompt lists available operations (list/create/detail) based on layout presence
    - Test that a model with no layout sections is described as having no available pages
    - _Requirements: 13.3_

- [ ] 25. Implement `buildAITools(app, session)` in `tanstack-use-ai`
  - [ ] 25.1 Create `packages/tanstack-use-ai/src/build-ai-tools.ts`
    - For each model and each operation (`list`, `create`, `update`, `delete`), call `can(session, target, app)`
    - Register a TanStack AI `toolDefinition` only for permitted operations
    - Each tool's `execute` function calls the corresponding API endpoint and returns the result
    - The `list` tool executor calls `GET /api/{tableName}` and returns the records array
    - The `create` tool executor calls `POST /api/{tableName}` with the provided fields
    - _Requirements: 13.1, 13.2, 13.4, 13.8_

  - [ ] 25.2 Write unit tests for `buildAITools`
    - Test that a session with `create` permission gets a `create{ModelName}` tool
    - Test that a session without `create` permission does NOT get a `create{ModelName}` tool
    - Test that an empty-permission model (open access) generates tools for all operations
    - Test that the `list` tool executor calls the correct API endpoint
    - _Requirements: 13.2, 13.8, 10.12_

  - [ ] 25.3 Write property test for AI tool permission boundaries (Property 8)
    - **Property 8: AI tools respect permission boundaries**
    - Generate random permission configs and member group lists; assert `buildAITools` generates a tool for operation X iff `can()` returns `true` for that operation
    - **Validates: Requirements 13.2, 13.8**
    - _Requirements: 10.12_

- [ ] 26. Implement `ChatBot` component in `tanstack-use-ai`
  - [ ] 26.1 Create `packages/tanstack-use-ai/src/ChatBot.tsx`
    - Accept `app`, `session`, and `adapter` (TanStack AI adapter) as props
    - On mount: call `buildAITools(app, session)` and `buildSystemPrompt(app)`
    - Use TanStack AI's chat hook with the developer-supplied adapter, tools, and system prompt
    - Stream responses; render a floating chat panel with a toggle button
    - When a tool response includes a navigation target, call TanStack Router's `navigate()`
    - _Requirements: 13.1, 13.5, 13.6, 13.7_

  - [ ]* 26.2 Write unit tests for `ChatBot`
    - Test that the chat panel renders and can be toggled open/closed
    - Test that `buildAITools` is called with the correct session on mount
    - Test that a tool call for a navigation action triggers `navigate()`
    - _Requirements: 13.5, 13.7_

- [ ] 27. Create `packages/tanstack-use-ai/src/index.ts` barrel export
  - Re-export `buildAITools`, `buildSystemPrompt`, `ChatBot`
  - _Requirements: 13.1_

- [ ] 28. Integration tests across packages
  - [ ] 28.1 Write an integration test that defines a model, registers it with `defineApp()`, generates routes, and asserts the correct routes are created
    - Use a real Drizzle table definition (in-memory, no DB connection needed)
    - Assert list/detail/create routes exist only when the corresponding layout sections are defined
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 4.2_

  - [ ]* 28.2 Write an integration test for the full permission flow
    - Define a model with restricted `create` permission
    - Call `can()` with a session that has a matching group → assert `true`
    - Call `can()` with a session that has no matching group → assert `false`
    - _Requirements: 5.2, 5.3_

  - [ ]* 28.3 Write an integration test for the full file upload flow
    - Define a `fileModel()` with `fileAccess: ["admin"]`
    - Call `handleUpload` with an admin session → assert path returned
    - Call `handleUpload` with a non-admin session → assert `AuthorizationError` thrown
    - _Requirements: 6.3, 6.5_

  - [ ]* 28.4 Write an integration test for server lifecycle hooks
    - Define a model with `beforeCreate` that throws
    - Call `executeCreate` → assert no DB insert and error propagated
    - Define a model with `afterCreate` that throws
    - Call `executeCreate` → assert record persisted and error logged
    - _Requirements: 8.2, 8.3_

  - [ ]* 28.5 Write an integration test for the AI tools + permission flow
    - Define a model with `create: ["admin"]` permission
    - Call `buildAITools` with an admin session → assert `createEmployee` tool present
    - Call `buildAITools` with a non-admin session → assert `createEmployee` tool absent
    - _Requirements: 13.2, 13.8_

- [ ] 29. Final checkpoint — all packages
  - Ensure all tests across all packages pass, ask the user if questions arise.

- [x] 26. Support callable label (`() => string`) in `UIFieldDef` for i18n
  - [x] 26.1 Update `UIFieldDef` in `packages/tanstack-use-core/src/types.ts`
    - Change `label` to `label?: () => string` (function-only, no string union)
    - Remove `TranslationConfig` interface and `translations` property from `UIConfig`
    - _Requirements: 9.1, 9.5_

  - [x] 26.2 Update `resolveLabel` in `packages/tanstack-use-ui/src/label-resolver.ts`
    - Implementation: `return model.ui.fields?.[fieldName]?.label?.() ?? fieldName`
    - _Requirements: 9.2, 9.3, 9.4_

  - [x] 26.3 Update tests in `packages/tanstack-use-ui/src/label-resolver.test.ts`
    - All tests use `() => string` label form only
    - _Requirements: 9.2, 9.3, 9.4, 10.6_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at package boundaries
- Property tests validate universal correctness properties (Properties 1–9 from the design document)
- Unit tests validate specific examples and edge cases
- Compile-time type tests (tsd) validate TypeScript enforcement of layout and dependsOn constraints
- The AI chatbot (`tanstack-use-ai`) is provider-agnostic — developers supply a TanStack AI adapter; no LLM is hard-coded
