# Implementation Plan: tanstack-use-todo

## Overview

Adapt the existing TanStack Start scaffolded app at `packages/tanstack-use-todo` to use the tanstack-use framework for a per-user todo list. Tasks migrate the package from npm to pnpm, add the framework dependencies, create the Drizzle schema and model, wire up server functions, and add the three todo route files.

## Tasks

- [x] 1. Migrate package from npm to pnpm and add framework dependencies
  - Delete `packages/tanstack-use-todo/package-lock.json`
  - Delete `packages/tanstack-use-todo/node_modules`
  - Update `packages/tanstack-use-todo/package.json`: change `name` from `"todo"` to `"@tanstack-use/todo"`, add `@tanstack-use/core`, `@tanstack-use/ui`, `drizzle-orm`, and `pg` as dependencies; add `@types/pg` as a devDependency
  - Add `"packages/tanstack-use-todo"` to the `packages` array in the root `pnpm-workspace.yaml`
  - Run `pnpm install` from the workspace root to link workspace packages and hoist dependencies
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2. Create the Drizzle DB connection
  - [x] 2.1 Add `pg` and `@types/pg` to `packages/tanstack-use-todo/package.json` (if not already present from task 1) and run `pnpm install`
  - [x] 2.2 Create `packages/tanstack-use-todo/src/lib/db.ts`
    - Import `drizzle` from `drizzle-orm/node-postgres` and `Pool` from `pg`
    - Create a `Pool` using `process.env.DATABASE_URL` as the connection string
    - Call `drizzle(pool)` and export the result as `db`
    - _Requirements: 1.3_
  - [x] 2.3 Add `DATABASE_URL` to `.env` (or `.env.local`) at `packages/tanstack-use-todo/` pointing to a local or hosted Postgres instance (e.g. `postgresql://user:password@localhost:5432/todos`)

- [x] 3. Define the Drizzle schema
  - [x] 3.1 Create `packages/tanstack-use-todo/src/lib/schema.ts`
    - Import `pgTable`, `serial`, `text`, `boolean`, `timestamp` from `drizzle-orm/pg-core`
    - Define `todosTable` with columns: `id` (serial primary key), `title` (text not null), `completed` (boolean not null default false), `userId` (text not null), `createdAt` (timestamp not null default now)
    - Export `todosTable` as a named export
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Define the model
  - [x] 4.1 Create `packages/tanstack-use-todo/src/lib/model.ts`
    - Import `defineModel` from `@tanstack-use/core` and `todosTable` from `./schema.js`
    - Call `defineModel(todosTable, uiConfig)` and export the result as `todoModel`
    - Configure `layout.list: ["title", "completed"]`
    - Configure `layout.detail` as a single tab `{ label: "Details", rows: [["title"], ["completed"], ["createdAt"]] }`
    - Configure `layout.create: ["title"]`
    - Configure `fields.title.label: () => "Title"` and `fields.title.validate` to return an error string when the value is empty or whitespace-only, and `undefined` when valid
    - Configure `fields.completed.label: () => "Completed"`
    - Configure `fields.createdAt.label: () => "Created At"`
    - Configure `server.beforeCreate` as an async hook that sets `record.userId = session.userId`
    - _Requirements: 2.1–2.8, 3.1, 3.2, 8.4_

- [x] 5. Define the app
  - [x] 5.1 Create `packages/tanstack-use-todo/src/lib/todo-app.ts`
    - Import `defineApp` from `@tanstack-use/core`, `auth` from `./auth.js`, and `todoModel` from `./model.js`
    - Call `defineApp({ models: [todoModel], auth: auth as any })` and export the result as `todoApp`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Create server functions
  - [x] 6.1 Create `packages/tanstack-use-todo/src/lib/server-functions.ts`
    - Add `"use server"` directive at the top
    - Import `createServerFunctions` from `@tanstack-use/ui`, `todoApp` from `./todo-app.js`, and `db` from `./db.js`
    - Call `createServerFunctions(todoApp, db)` and export the result as `todoServerFunctions`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Add ServerFunctionsProvider to the root layout
  - [x] 7.1 Modify `packages/tanstack-use-todo/src/routes/__root.tsx`
    - Import `ServerFunctionsProvider` from `@tanstack-use/ui` and `todoServerFunctions` from `#/lib/server-functions`
    - Wrap the `{children}` in `RootDocument` with `<ServerFunctionsProvider fns={todoServerFunctions}>`
    - _Requirements: 5.1_

- [x] 8. Add todo routes
  - [x] 8.1 Create `packages/tanstack-use-todo/src/routes/todos/index.tsx`
    - Import `createFileRoute` from `@tanstack/react-router` and `ListPage` from `@tanstack-use/ui`
    - Import `todoModel` from `#/lib/model`
    - Export `Route = createFileRoute("/todos/")({ component: () => <ListPage model={todoModel} /> })`
    - _Requirements: 6.2, 9.1, 9.2, 9.3, 9.4_
  - [x] 8.2 Create `packages/tanstack-use-todo/src/routes/todos/new.tsx`
    - Import `createFileRoute` from `@tanstack/react-router` and `CreatePage` from `@tanstack-use/ui`
    - Import `todoModel` from `#/lib/model`
    - Export `Route = createFileRoute("/todos/new")({ component: () => <CreatePage model={todoModel} /> })`
    - _Requirements: 6.4, 8.1, 8.2, 8.3_
  - [x] 8.3 Create `packages/tanstack-use-todo/src/routes/todos/$id.tsx`
    - Import `createFileRoute` from `@tanstack/react-router` and `DetailPage` from `@tanstack-use/ui`
    - Import `todoModel` from `#/lib/model`
    - Export `Route = createFileRoute("/todos/$id")({ component: () => <DetailPage model={todoModel} /> })`
    - _Requirements: 6.3, 10.1, 10.2, 11.1, 11.2_

## Notes

- The app uses **file-based routing** — TanStack Router's Vite plugin auto-generates `routeTree.gen.ts` when files are added under `src/routes/`. No manual route registration is needed.
- The existing `src/router.tsx`, `src/lib/auth.ts`, `src/lib/auth-client.ts`, `vite.config.ts`, and `tsconfig.json` are **not modified** (except `__root.tsx` for the provider).
- The DB connection in `src/lib/db.ts` uses `drizzle-orm/node-postgres` with a `pg` `Pool`. The connection string is read from `DATABASE_URL` in the environment. Both Better Auth and Drizzle should point to the same Postgres database.
- After `pnpm install`, the `node_modules` inside `packages/tanstack-use-todo` will be replaced by pnpm's symlinked structure from the workspace root.
