# Implementation Plan: tanstack-use

## Overview

Implement the `tanstack-use` meta-framework as a TypeScript monorepo with four packages: `tanstack-use-core`, `tanstack-use-permissions`, `tanstack-use-files`, and `tanstack-use-ui`. Tasks follow TDD order — types and tests are established before or alongside each feature, with property-based tests (fast-check) and unit tests (Vitest) throughout.

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
    - Export `InferRecord<T>`, `AllFieldKeys<T, TComputed>`, `ComputedFieldDef<T>`, `UIFieldDef<T>`, `TabDef`, `LayoutDef`, `TranslationConfig`, `PermissionsDef`, `ServerHooks<T>`, `ClientHooks<T>`, `UIConfig<T>`, `Model<T>`, `App`
    - Use non-empty tuple `[keyof T["_"]["columns"], ...(keyof T["_"]["columns"])[]]` for `ComputedFieldDef.dependsOn`
    - _Requirements: 1.1, 1.4, 2.4, 3.1, 3.4, 8.1_

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

- [ ] 15. Implement label resolution and translation utilities in `tanstack-use-ui`
  - [ ] 15.1 Create `packages/tanstack-use-ui/src/label-resolver.ts`
    - Implement `resolveLabel(fieldName: string, model: Model<any>, locale?: string): string`
    - Priority: `ui.fields[fieldName].label` → `translations.fieldLabels[fieldName]` → `fieldName`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 15.2 Write unit tests for label resolution
    - Test explicit `ui.fields[fieldName].label` takes priority
    - Test `translations.fieldLabels` used when no explicit label
    - Test fallback to field key name when no translation exists
    - Test fallback when no `translations` config is provided at all
    - _Requirements: 9.3, 9.4, 9.5, 10.6_

- [ ] 16. Implement route generation in `tanstack-use-ui`
  - [ ] 16.1 Create `packages/tanstack-use-ui/src/create-routes.ts`
    - Implement `createRoutes(app: App): RouteObject[]`
    - Iterate `app.models`; for each model register list route if `ui.layout?.list` is defined, detail route if `ui.layout?.detail` is defined, create route if `ui.layout?.create` is defined
    - Use `model.table[Symbol.for("drizzle:Name")]` as the URL segment
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 7.1, 7.2, 7.3_

  - [ ]* 16.2 Write unit tests for route generation
    - Test no routes registered when `ui.layout` is entirely absent
    - Test only list route registered when only `ui.layout.list` is defined
    - Test all three routes registered when all layout sections are defined
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 10.5_

  - [ ]* 16.3 Write property test for page existence (Property 6)
    - **Property 6: Page existence matches layout presence**
    - Generate random UIConfig with present/absent layout sections; assert generated routes match exactly the defined sections
    - **Validates: Requirements 1.5, 1.6, 1.7, 1.8**
    - _Requirements: 10.5_

- [ ] 17. Implement `ListPage` component in `tanstack-use-ui`
  - [ ] 17.1 Create `packages/tanstack-use-ui/src/components/ListPage.tsx`
    - Read `model.ui.layout.list` for column order
    - Use TanStack Query `useQuery` to fetch all records from `GET /api/{tableName}`
    - For each column: if it is a computed field key, call `cf.format ? cf.format(row) : String(cf.compute(row))`; otherwise call `uiField?.format ? uiField.format(row) : row[col]`
    - Render a `<table>` with headers resolved via `resolveLabel`
    - _Requirements: 7.1, 7.4, 3.3_

  - [ ]* 17.2 Write unit tests for `ListPage`
    - Test that columns match `ui.layout.list` order
    - Test that `format(record)` is called with the full record (not just the field value)
    - Test that computed field values are rendered via `compute(record)`
    - _Requirements: 7.4, 3.3, 10.7_

  - [ ]* 17.3 Write property test for format/compute receiving full record (Property 3)
    - **Property 3: format and compute receive the full record**
    - Generate random records and format/compute functions; assert the value rendered equals calling the function with the full record object
    - **Validates: Requirements 3.5, 7.4**
    - _Requirements: 10.7, 10.9_

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

- [ ] 19. Implement `CreatePage` component and `onSubmit` hook in `tanstack-use-ui`
  - [ ] 19.1 Create `packages/tanstack-use-ui/src/components/CreatePage.tsx`
    - Filter `model.ui.layout.create` to exclude computed field keys
    - Render a `<form>` with `<FieldInput>` for each non-computed field
    - Implement `handleSubmit`: if `model.ui.client?.onSubmit` is defined, call it with the record and use the returned value; then POST to `/api/{tableName}`
    - _Requirements: 7.3, 7.7, 3.2_

  - [ ]* 19.2 Write unit tests for `CreatePage`
    - Test computed fields are excluded from the form field list
    - Test `onSubmit` hook is called with the full record before submission
    - Test the value submitted to the API is the return value of `onSubmit`, not the original record
    - _Requirements: 3.2, 7.7, 10.2, 10.7_

  - [ ]* 19.3 Write property test for onSubmit transformation (Property 7)
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
  - Re-export `createRoutes`, `ListPage`, `DetailPage`, `CreatePage`, `FieldDisplay`, `FieldInput`
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 23. Checkpoint — UI package
  - Ensure all tests in `tanstack-use-ui` pass, ask the user if questions arise.

- [ ] 24. Integration tests across packages
  - [ ] 24.1 Write an integration test that defines a model, registers it with `defineApp()`, generates routes, and asserts the correct routes are created
    - Use a real Drizzle table definition (in-memory, no DB connection needed)
    - Assert list/detail/create routes exist only when the corresponding layout sections are defined
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 4.2_

  - [ ]* 24.2 Write an integration test for the full permission flow
    - Define a model with restricted `create` permission
    - Call `can()` with a session that has a matching group → assert `true`
    - Call `can()` with a session that has no matching group → assert `false`
    - _Requirements: 5.2, 5.3_

  - [ ]* 24.3 Write an integration test for the full file upload flow
    - Define a `fileModel()` with `fileAccess: ["admin"]`
    - Call `handleUpload` with an admin session → assert path returned
    - Call `handleUpload` with a non-admin session → assert `AuthorizationError` thrown
    - _Requirements: 6.3, 6.5_

  - [ ]* 24.4 Write an integration test for server lifecycle hooks
    - Define a model with `beforeCreate` that throws
    - Call `executeCreate` → assert no DB insert and error propagated
    - Define a model with `afterCreate` that throws
    - Call `executeCreate` → assert record persisted and error logged
    - _Requirements: 8.2, 8.3_

- [ ] 25. Final checkpoint — all packages
  - Ensure all tests across all packages pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at package boundaries
- Property tests validate universal correctness properties (Properties 1–7 from the design document)
- Unit tests validate specific examples and edge cases
- Compile-time type tests (tsd) validate TypeScript enforcement of layout and dependsOn constraints
