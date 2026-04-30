# Requirements Document

## Introduction

A self-contained todo list application package (`packages/tanstack-use-todo`) built on top of the tanstack-use framework. The application demonstrates the full framework stack: a Drizzle ORM schema, a `defineModel` definition, a `defineApp` registration, auto-generated CRUD server functions, and TanStack Router routes. Every authenticated user sees and manages only their own todos — user isolation is enforced server-side via a `userId` foreign key and a `beforeCreate` server hook that injects the session's `userId` before persistence.

The package is structured as a standalone TanStack Start application entry point, consistent with the other packages in the monorepo.

---

## Glossary

- **Todo**: A single task record owned by one user, stored in the `todos` Drizzle table. Has fields: `id`, `title`, `completed`, `userId`, `createdAt`.
- **TodoModel**: The `Model` object produced by `defineModel(todosTable, uiConfig)`.
- **TodoApp**: The `App` object produced by `defineApp({ models: [TodoModel], auth })`.
- **TodoSchema**: The Drizzle `PgTable` definition for the `todos` table.
- **Server**: The TanStack Start server runtime that executes server functions.
- **ServerFunctions**: The five CRUD functions (`list`, `get`, `create`, `update`, `remove`) produced by `createServerFunctions(TodoApp, db)`.
- **Session**: The Better Auth session object, containing at minimum `userId` and user info.
- **UserId**: The `userId` string field on a Todo record that identifies the owning user.
- **ListPage**: The auto-generated page component from `@tanstack-use/ui` that renders a table of todos.
- **DetailPage**: The auto-generated page component from `@tanstack-use/ui` that renders a single todo's fields.
- **CreatePage**: The auto-generated page component from `@tanstack-use/ui` that renders a form for creating a new todo.
- **BeforeCreateHook**: The `server.beforeCreate` callback on the TodoModel that injects `userId` from the session before a todo is persisted.

---

## Requirements

### Requirement 1: Drizzle Schema

**User Story:** As a developer, I want a Drizzle PgTable schema for todos, so that the database structure is defined in a type-safe, framework-compatible way.

#### Acceptance Criteria

1. THE TodoSchema SHALL define a `todos` table with columns: `id` (serial primary key), `title` (text, not null), `completed` (boolean, not null, default false), `userId` (text, not null), and `createdAt` (timestamp, not null, default now).
2. THE TodoSchema SHALL export the table as a named export `todosTable` from `src/schema.ts`.
3. THE TodoSchema SHALL be a valid Drizzle `pgTable` definition compatible with `drizzle-orm/pg-core`.

---

### Requirement 2: Model Definition

**User Story:** As a developer, I want a `defineModel` call that wraps the todos schema with UI configuration, so that the framework can auto-generate pages and server functions.

#### Acceptance Criteria

1. THE TodoModel SHALL be produced by calling `defineModel(todosTable, uiConfig)` from `@tanstack-use/core`.
2. THE TodoModel SHALL configure a `layout.list` array that includes `title` and `completed` columns, so that the ListPage renders those fields.
3. THE TodoModel SHALL configure a `layout.detail` array of tabs that includes at minimum `title`, `completed`, and `createdAt` fields, so that the DetailPage renders the full todo.
4. THE TodoModel SHALL configure a `layout.create` array that includes `title`, so that the CreatePage renders a creation form with only the user-facing fields.
5. THE TodoModel SHALL configure `fields.title.label` as a function returning `"Title"`.
6. THE TodoModel SHALL configure `fields.completed.label` as a function returning `"Completed"`.
7. THE TodoModel SHALL configure `fields.createdAt.label` as a function returning `"Created At"`.
8. THE TodoModel SHALL be exported as a named export `todoModel` from `src/model.ts`.

---

### Requirement 3: User Isolation via Server Hook

**User Story:** As an authenticated user, I want my todos to be isolated from other users' todos, so that I can only see and manage my own data.

#### Acceptance Criteria

1. THE TodoModel SHALL configure a `server.beforeCreate` hook that sets `record.userId` to `session.userId` before the record is persisted.
2. WHEN the `beforeCreate` hook is invoked, THE Server SHALL overwrite any client-supplied `userId` value with the value from the session, so that users cannot create todos on behalf of other users.
3. THE ServerFunctions `list` function SHALL filter the `todos` query by the authenticated user's `userId`, so that each user receives only their own todos.
4. IF a request to list todos is made without an authenticated session, THEN THE Server SHALL return an empty result set or throw an authorization error.

---

### Requirement 4: App Definition

**User Story:** As a developer, I want a `defineApp` call that registers the TodoModel and the Better Auth instance, so that the framework has a single registry for routing and server functions.

#### Acceptance Criteria

1. THE TodoApp SHALL be produced by calling `defineApp({ models: [todoModel], auth })` from `@tanstack-use/core`.
2. THE TodoApp SHALL register exactly one model: `TodoModel`, keyed by the table name `"todos"`.
3. THE TodoApp SHALL be exported as a named export `todoApp` from `src/app.ts`.
4. THE TodoApp SHALL accept a Better Auth instance as its `auth` property, consistent with the `BetterAuthInstance` interface from `@tanstack-use/core`.

---

### Requirement 5: Server Functions

**User Story:** As a developer, I want auto-generated CRUD server functions for todos, so that the UI can perform list, get, create, update, and remove operations without hand-written API routes.

#### Acceptance Criteria

1. THE ServerFunctions SHALL be produced by calling `createServerFunctions(todoApp, db)` from `@tanstack-use/ui`.
2. THE ServerFunctions SHALL expose five functions: `list`, `get`, `create`, `update`, and `remove`.
3. WHEN `create` is called, THE Server SHALL invoke the `beforeCreate` hook before persisting the record, ensuring `userId` is set from the session.
4. WHEN `create` is called with a session whose user does not have create permission, THE Server SHALL throw an `AuthorizationError`.
5. THE ServerFunctions SHALL be exported as a named export `serverFunctions` from `src/server-functions.ts`.

---

### Requirement 6: Route Setup

**User Story:** As a developer, I want TanStack Router routes auto-generated from the TodoApp, so that the list, detail, and create pages are accessible at predictable URLs.

#### Acceptance Criteria

1. THE Application SHALL call `createRoutes(todoApp, rootRoute)` from `@tanstack-use/ui` to generate routes.
2. THE Application SHALL register a list route at `/todos`.
3. THE Application SHALL register a detail route at `/todos/$id`.
4. THE Application SHALL register a create route at `/todos/new`.
5. THE Application SHALL export the router as a named export `router` from `src/router.ts`.

---

### Requirement 7: Package Structure

**User Story:** As a developer, I want the todo package to be a self-contained monorepo package, so that it can be developed, tested, and run independently.

#### Acceptance Criteria

1. THE Package SHALL have a `package.json` at `packages/tanstack-use-todo/package.json` with `name` set to `"@tanstack-use/todo"`.
2. THE Package SHALL declare `@tanstack-use/core` and `@tanstack-use/ui` as dependencies using `workspace:*`.
3. THE Package SHALL include a `tsconfig.json` that extends the root `tsconfig.base.json`.
4. THE Package SHALL be listed in `pnpm-workspace.yaml` under the `packages` array.
5. THE Package source files SHALL reside under `packages/tanstack-use-todo/src/`.

---

### Requirement 8: Create Todo Flow

**User Story:** As an authenticated user, I want to create a new todo by entering a title, so that I can track tasks I need to complete.

#### Acceptance Criteria

1. WHEN a user submits the create form with a non-empty `title`, THE CreatePage SHALL call the `create` server function with the form data and the current session.
2. WHEN the `create` server function succeeds, THE Application SHALL navigate the user to the list page at `/todos`.
3. IF the `title` field is empty when the form is submitted, THEN THE CreatePage SHALL display a validation error and SHALL NOT call the `create` server function.
4. THE TodoModel `fields.title.validate` function SHALL return an error string when the value is empty or whitespace-only, and SHALL return `undefined` when the value is valid.

---

### Requirement 9: List Todos Flow

**User Story:** As an authenticated user, I want to see a list of my todos, so that I can review what tasks I have.

#### Acceptance Criteria

1. WHEN the list page at `/todos` is loaded, THE ListPage SHALL call the `list` server function with the `tableName` set to `"todos"`.
2. THE ListPage SHALL render a row for each todo returned by the `list` server function, displaying the `title` and `completed` columns.
3. THE ListPage SHALL render a link to the detail page for each todo row.
4. THE ListPage SHALL render a link to the create page at `/todos/new`.

---

### Requirement 10: View Todo Detail Flow

**User Story:** As an authenticated user, I want to view the full details of a todo, so that I can see all its fields.

#### Acceptance Criteria

1. WHEN the detail page at `/todos/$id` is loaded, THE DetailPage SHALL call the `get` server function with the `tableName` set to `"todos"` and the `id` from the route params.
2. THE DetailPage SHALL render the `title`, `completed`, and `createdAt` fields of the todo.
3. IF the `get` server function returns a record whose `userId` does not match the session's `userId`, THEN THE Server SHALL have already prevented the record from being returned (enforced at the server function layer, not the UI layer).

---

### Requirement 11: Complete a Todo

**User Story:** As an authenticated user, I want to mark a todo as completed, so that I can track my progress.

#### Acceptance Criteria

1. WHEN a user updates the `completed` field on the detail page, THE DetailPage SHALL call the `update` server function with the updated record and the current session.
2. WHEN the `update` server function succeeds, THE DetailPage SHALL reflect the updated `completed` value.
3. THE TodoModel SHALL configure `layout.detail` to include the `completed` field in an editable tab, so that the DetailPage renders an edit control for it.
