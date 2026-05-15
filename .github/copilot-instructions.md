# GitHub Copilot Instructions for TanStack Unified Schema Engine

## Project Overview

**TanStack Unified Schema Engine** (`tanstack-use`) is a TypeScript framework that auto-generates UI and data layers with minimal code. Developers define models by combining Drizzle ORM schemas with lightweight UI configurations, and the framework automatically generates:

- **UI Pages**: List, Detail, and Create pages using TanStack Router, TanStack Query, TanStack Table, and TanStack Form
- **Server Functions**: CRUD operations using TanStack Start
- **Permissions**: Group-based access control using Better Auth
- **AI Tools**: Auto-generated chatbots using TanStack AI

## Technology Stack

- **Language**: TypeScript (strict mode, ESNext/ES2022 target, `"type": "module"`)
- **Package Manager**: pnpm (monorepo workspace with workspace protocol)
- **Build Tools**: Vite, TanStack Start with multiple deployment adapters
- **Linting & Formatting**: Biome (2-space indents, 100-char line width, double quotes, trailing commas, semicolons)
- **Testing**: Vitest with fast-check (property-based testing) and tsd (type-level tests)
- **Styling**: Tailwind CSS v4 + Shadcn/ui + Radix UI
- **Database**: Drizzle ORM with PostgreSQL (`pg` driver)
- **State Management**: TanStack Query, TanStack Form, TanStack Router
- **Authentication**: Better Auth with organization plugin for group-based permissions
- **AI Integration**: TanStack AI for chatbot generation
- **Validation**: Zod for schema validation

## Core Concepts

### Model
A schema unit created via `defineModel(drizzleTable, uiConfig)` that ties a Drizzle table to a UI layout. Models are the primary abstraction for defining data and UI simultaneously.

### App / Engine
The global registry created via `defineApp()` that aggregates all models and the Better Auth instance. Each model is passed to `defineApp` along with the Better Auth configuration.

### UIConfig
A typed overlay configuration that defines:
- `layout`: List, Detail, and Create views (absent properties mean pages are not generated)
- `computedFields`: Read-only derived fields with `dependsOn` arrays and `compute` functions
- `fields`: Per-field UI overrides (labels, formatting, validation, hidden state)

### Permissions
Defined in model config under `permissions` block with `read`, `create`, `update`, `delete` as arrays of Better Auth group names. Enforced automatically; operations throw `AuthorizationError` if user lacks permission.

### Computed Fields
Read-only UI fields declared with:
- `dependsOn`: Array of Drizzle column keys the field depends on
- `compute(record)`: Function that derives the value from the full typed record
- `format(record)`: Optional formatting function for display

### File Fields
Declared via `fileModel()`, which manages storage and file access permissions automatically. Integrated with the file handler and storage adapter system.

## Project Structure

```
packages/
  tanstack-use-core/          # Core framework logic (types, defineModel, defineApp, server functions)
  tanstack-use-ui/            # UI generators (page components, route creation)
  tanstack-use-permissions/   # Permission system (authorization errors, permission guards)
  tanstack-use-files/         # File handling (storage adapter, file model)
  tanstack-use-ai/            # AI integration (chatbot generation, tool building)
  tanstack-use-todo/          # Demo app showcasing the framework
```

Each package is independently typed and published. Dependencies flow one direction: consuming packages depend on core, but not vice versa.

## Development Rules & Patterns

### 1. No Manual API Routes
All CRUD operations must go through auto-generated TanStack Start server functions created via `createServerFunctions()`. Direct API routes bypass the permission and hook system and are forbidden.

### 2. Strict Typing
- `defineModel()` strictly infers types from the Drizzle table
- Layout fields must match Drizzle columns or defined computed fields
- Use `InferRecord<T>` to get the typed record shape
- Never use `any`; use proper generic inference instead

### 3. User Isolation
Inject user/tenant context via `server.beforeCreate` hooks:
```typescript
server: {
  beforeCreate: async (input, context) => {
    return { ...input, userId: context.session.user.id };
  }
}
```
Always verify tenant/user ownership in read, update, and delete operations.

### 4. Permissions Enforcement
- Define permissions using Better Auth group names
- Use `can()` helper to check permissions before operations
- Let the framework throw `AuthorizationError` automatically on permission failure
- Never silently fail or return empty results for unauthorized access

### 5. Labels and i18n
Define labels as zero-argument functions for i18n compatibility:
```typescript
label: () => "Display Name"  // Static
label: m.displayName        // Paraglide JS integration
```
Functions are called on every render for automatic locale switching.

### 6. Computed Fields & Hidden Fields
Use computed fields for derived data:
```typescript
computedFields: {
  fullName: {
    dependsOn: ["firstName", "lastName"],
    compute: (record) => `${record.firstName} ${record.lastName}`,
    format: (record) => `${record.firstName} ${record.lastName}`
  }
}
```

Use `hidden` for conditional field visibility:
```typescript
hidden: (record) => record.status === "archived"
```

### 7. Form Validation
Define field-level validators:
```typescript
fields: {
  email: {
    validate: (value) => {
      if (!value?.includes("@")) return "Invalid email";
      return undefined;
    }
  }
}
```

### 8. Page Generation
- Absent `layout` properties mean pages are not generated (no list page if `layout.list` is undefined)
- All lists use TanStack Table
- All forms use TanStack Form
- Detail pages use tabs defined in `TabDef`

## Code Style & Conventions

### Formatting
- **Indent**: 2 spaces
- **Line Width**: 100 characters
- **Quotes**: Double quotes
- **Trailing Commas**: All (in multi-line structures)
- **Semicolons**: Always
- Tools: `pnpm lint`, `pnpm format`, `pnpm check` (uses Biome)

### TypeScript
- Enable strict mode in all `tsconfig.json`
- No `any` types allowed
- Use generic inference over manual type annotations
- Export types from package entry points via `index.ts`
- Use JSDoc for public API documentation

### Imports
- Organize imports alphabetically and by type (types first)
- Use ES modules (`import`/`export`)
- Relative imports within packages, absolute imports across packages

### Testing
- File naming: `*.test.ts`, `*.property.test.ts`, `*.test-d.ts`
- Use Vitest for unit/integration tests
- Use fast-check for property-based testing
- Use tsd for type assertion tests
- Mock `better-auth` context in server function tests

## Common Patterns

### Defining a Model
```typescript
import { defineModel } from "@tanstack-use/core";
import { usersTable } from "./schema.js";

export const userModel = defineModel(usersTable, {
  layout: {
    list: ["id", "name", "email"],
    detail: [
      { label: "Personal", rows: [["name", "email"], ["role"]] }
    ],
    create: ["name", "email"]
  },
  fields: {
    email: { label: () => "Email Address" },
    role: { label: () => "User Role" }
  },
  permissions: {
    read: ["admin", "user"],
    create: ["admin"],
    update: ["admin", "self"], // special: checked in beforeUpdate
    delete: ["admin"]
  }
});
```

### Creating an App
```typescript
import { defineApp } from "@tanstack-use/core";
import { betterAuth } from "./auth.js";

export const app = defineApp(betterAuth, [userModel, projectModel, taskModel]);
```

### Server Lifecycle Hooks
```typescript
server: {
  beforeCreate: async (input, context) => {
    // Inject user context
    return { ...input, userId: context.session.user.id };
  },
  afterCreate: async (record, context) => {
    // Side effects: send emails, trigger webhooks, etc.
  },
  beforeUpdate: async (input, context) => {
    // Validate business logic
    if (input.status === "locked") {
      throw new AuthorizationError("Cannot lock records");
    }
    return input;
  },
  afterUpdate: async (record, context) => {
    // Side effects
  }
}
```

### Generating Server Functions
```typescript
import { createServerFunctions } from "@tanstack-use/core";

export const api = createServerFunctions(app, {
  // Middleware for all server functions
  before: async (context) => {
    const session = await auth.api.getSession({ headers: context.headers });
    return { ...context, session };
  }
});
```

### Using File Fields
```typescript
import { fileModel } from "@tanstack-use/files";

const profilePhotoModel = fileModel(
  { table: usersTable, column: "profilePhoto" },
  { storage: s3Adapter, permissions: { read: ["all"], write: ["self"] } }
);
```

## Monorepo & Dependency Management

- All packages use pnpm workspaces
- Root `pnpm-workspace.yaml` defines workspace structure
- Shared dependencies in `pnpm-lock.yaml` (managed via pnpm catalog)
- Use `pnpm --filter <package-name>` to run commands in specific workspace packages
- Native dependencies configured in `pnpm.onlyBuiltDependencies` (`esbuild`, `lightningcss`)

### Common Commands

```bash
# Testing
pnpm test              # Run all tests once (vitest run)
pnpm test:watch        # Vitest in watch mode

# Code Quality
pnpm typecheck         # Type check all packages
pnpm lint              # Biome lint
pnpm format            # Biome format (write)
pnpm check             # Biome check + fix (comprehensive)

# Development
pnpm --filter @tanstack-use/todo dev     # Start dev server on port 3000
pnpm --filter @tanstack-use/todo build   # Production build
pnpm --filter @tanstack-use/todo seed    # Seed the database
pnpm --filter @tanstack-use/todo test    # Run todo app tests

# Dependency Management
pnpm add <pkg>                                  # Add to current package
pnpm --filter @tanstack-use/todo add <pkg>     # Add to specific package

# Database
pnpm dlx drizzle-kit generate   # Generate migration files
pnpm dlx drizzle-kit migrate    # Apply migrations
```

## Common Mistakes to Avoid

1. **Mixing manual API routes with server functions**: All data operations must go through `createServerFunctions()`
2. **Forgetting user isolation**: Always inject `userId` or tenant context in `beforeCreate`
3. **Using `any` types**: Use generics and proper type inference
4. **Hardcoding permissions**: Use Better Auth groups; make permissions data-driven
5. **Forgetting computed field dependencies**: Always specify `dependsOn` array for computed fields
6. **Creating pages without layout definitions**: Set `layout.list`, `layout.detail`, `layout.create` explicitly
7. **Mixing i18n and static labels**: Use functions consistently; avoid string literals in config
8. **Not handling errors from server functions**: Always wrap server calls in try-catch; handle `AuthorizationError`

## Debugging Tips

- Use `pnpm typecheck` to catch type errors early
- Run `pnpm lint` and `pnpm format` before committing
- Check Better Auth context in server functions; ensure session is available
- Log permission checks and server lifecycle hooks to debug access issues
- Use Vitest `--ui` flag for interactive test debugging

## References

- TanStack Router: https://tanstack.com/router/latest
- TanStack Start: https://tanstack.com/start/latest
- TanStack Query: https://tanstack.com/query/latest
- Drizzle ORM: https://orm.drizzle.team/
- Better Auth: https://www.better-auth.com/
- Biome: https://biomejs.dev/
- Vitest: https://vitest.dev/

## Available Skills

This project includes specialized skills for common development tasks:

- **tanstack-router-best-practices**: Type-safe routing, data loading, search params, and navigation patterns. Use when setting up routes, implementing data loaders, or working with complex navigation.
- **tanstack-start-best-practices**: Server functions, middleware, SSR, authentication, and deployment patterns. Use when building full-stack features, setting up auth flows, or configuring server-side logic.

## Steering Documentation

Detailed project context is maintained in `.kiro/steering/`:

- **tech.md**: Complete tech stack details, build tools, code style enforcement, and common commands
- **product.md**: Product vision, core concepts (Model, App, UIConfig, Permissions), and key rules for framework usage
- **structure.md**: Project architecture and file organization

These documents are the source of truth for development decisions and should be consulted for complex architectural questions.
