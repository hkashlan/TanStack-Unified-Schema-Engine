# Product: tanstack-use

`tanstack-use` is a TypeScript framework that auto-generates UI and data layers from a single model definition. Developers define one model per entity using `defineModel()`, pairing a Drizzle ORM table with a UI configuration. The framework generates list, detail, and create pages, CRUD server functions, permission enforcement, and an AI chatbot — all from that single definition.

## Core Concepts

- **Model**: Defined via `defineModel(drizzleTable, uiConfig)`. The Drizzle table is the source of truth for types; `UIConfig` is a typed overlay for UI behavior.
- **App**: A global registry created via `defineApp({ models, auth })` that aggregates all models and the Better Auth instance.
- **UIConfig**: Configures `layout` (list/detail/create views), `fields` (labels, validation, formatting), `computedFields`, `permissions`, `server` hooks, and `fileFields`.
- **Permissions**: Group-based access control via Better Auth organization groups. Empty permission arrays mean unrestricted access.
- **Computed Fields**: Read-only derived fields declared with `dependsOn` (column keys) and a `compute` function. They appear in layouts alongside real columns.
- **Server Hooks**: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate` — used for user isolation (e.g. injecting `userId` from session) and side effects.
- **File Fields**: Declared via `fileModel()`, managing storage and access control automatically.

## Key Rules

- No manual API routes — all CRUD goes through auto-generated TanStack Start server functions.
- Layout fields must reference only valid column keys or declared computed field keys.
- User isolation is enforced via `server.beforeCreate` hooks (inject `userId` from session).
- Labels are zero-argument functions (`label: () => "Title"`) to support reactive i18n (e.g. Paraglide JS).
- Pages are generated conditionally: omitting `layout.list` means no list page is generated.
