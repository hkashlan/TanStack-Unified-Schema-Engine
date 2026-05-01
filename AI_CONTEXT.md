# Project Context: TanStack Unified Schema Engine (tanstack-use)

## Overview
`tanstack-use` is a TypeScript framework designed to auto-generate UI and data layers with minimal code. Developers define one model per file using `defineModel()` by providing a Drizzle schema and a UI configuration. The framework automatically generates:
- **UI Pages**: List, Detail, and Create pages using TanStack Router, TanStack Query, TanStack Table, and TanStack Form.
- **Server Functions**: CRUD operations using TanStack Start.
- **Permissions**: Group-based access control using Better Auth.
- **AI Tools**: An auto-generated chatbot using TanStack AI that understands the models and permitted actions.

## Core Concepts & Terminology
- **Engine / App**: The global registry created via `defineApp()` that aggregates all models and the Better Auth instance.
- **Model**: A schema unit defined via `defineModel(drizzleTable, uiConfig)` that ties a Drizzle table to a UI layout.
- **UIConfig**: An overlay configuration that defines `layout` (list, detail, create views), `computedFields`, and field configurations (labels, formats, validation).
- **Permissions**: Defined in the model config (`read`, `create`, `update`, `delete`), evaluated using Better Auth organization groups.
- **Computed Fields**: Read-only, derived UI fields declared with a `dependsOn` array (Drizzle column keys) and a `compute` function.
- **File Fields**: Declared via `fileModel()`, which manages storage and file access permissions automatically.
- **Server Lifecycle Hooks**: `server.beforeCreate`, `server.afterCreate`, `beforeUpdate`, `afterUpdate` allow injecting logic around persistence.

## Key Libraries Used
- **Drizzle ORM**: Used for database schema definition (`PgTable`).
- **TanStack Router**: Used for routing generated pages.
- **TanStack Start**: Used for Server Functions for data operations.
- **TanStack Query & Form & Table**: Used for managing UI state, validated forms, and rich data tables.
- **Better Auth**: Used for authentication and group-based authorization (specifically the organization plugin).
- **TanStack AI**: Powers the AI chatbot generation based on defined models.

## Development Rules & Patterns
1. **No Manual API Routes**: All CRUD operations must go through the auto-generated TanStack Start server functions (`createServerFunctions`).
2. **Strict Typing**: The `defineModel()` function strictly infers types from the Drizzle table. Any layout field must match a Drizzle column or a defined computed field.
3. **User Isolation**: Ensure user isolation via `server.beforeCreate` hooks. (e.g. injecting `userId` from the session).
4. **Permissions Enforcement**: Use Better Auth group names in the model's `permissions` block. Operations fail safely throwing an `AuthorizationError` if `can()` returns false.
5. **UI Rendering**: Pages are generated conditionally. If `ui.layout.list` is missing, no list page is generated. All lists use TanStack Table, forms use TanStack Form.
6. **I18n**: Labels are provided as functions (e.g. `label: () => "Title"`), easily integrated with Paraglide JS or similar.

## Project Structure
- `packages/tanstack-use-todo`: A demo/todo application showcasing the framework, maintaining user isolation.
- `packages/tanstack-unified-schema-engine`: Core framework logic.
