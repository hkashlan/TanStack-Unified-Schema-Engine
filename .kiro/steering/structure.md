# Project Structure

## Monorepo Layout

```
tanstack-use/                        # Workspace root
├── package.json                     # Root scripts, shared devDependencies
├── biome.json                       # Shared linter/formatter config
├── AI_CONTEXT.md                    # High-level project context
└── packages/
    ├── tanstack-use-core/           # @tanstack-use/core — framework primitives
    ├── tanstack-use-permissions/    # @tanstack-use/permissions — permission guard
    ├── tanstack-use-files/          # @tanstack-use/files — file field support
    ├── tanstack-use-ai/             # @tanstack-use/ai — AI chatbot generation
    ├── tanstack-use-ui/             # @tanstack-use/ui — generated UI components
    └── tanstack-use-todo/           # @tanstack-use/todo — demo/reference app
```

## Package Responsibilities

| Package | Role |
|---|---|
| `@tanstack-use/core` | `defineModel()`, `defineApp()`, `executeHooks()`, all shared types |
| `@tanstack-use/permissions` | `can()` permission guard, `rolesTable`, `userRolesTable`, `AuthorizationError` |
| `@tanstack-use/files` | `fileModel()`, storage adapters, file handler |
| `@tanstack-use/ai` | `buildAiTools()`, `buildSystemPrompt()`, `ChatBot` component |
| `@tanstack-use/ui` | Generated React pages (list, detail, create) using TanStack Router/Query/Form/Table |
| `@tanstack-use/todo` | Reference app — shows real-world usage with Drizzle + Better Auth + PostgreSQL |

## Package Internals (library packages)

```
packages/tanstack-use-<name>/
├── package.json          # "main" and "exports" both point to ./src/index.ts (no build step)
├── tsconfig.json
└── src/
    ├── index.ts          # Public API — explicit named exports only
    ├── *.ts              # Implementation modules
    ├── *.test.ts         # Unit tests (vitest)
    ├── *.property.test.ts  # Property-based tests (fast-check + vitest)
    └── *.test-d.ts       # Type-level tests (tsd)
```

## Todo App Internals

```
packages/tanstack-use-todo/
├── src/
│   ├── lib/
│   │   ├── schema.ts     # Drizzle table definitions
│   │   ├── model.ts      # defineModel() calls — one per entity
│   │   ├── db.ts         # Drizzle DB instance
│   │   ├── auth.ts       # Better Auth server config
│   │   └── auth-client.ts  # Better Auth client config
│   ├── components/       # Shared UI components (Header, Footer, login form, shadcn/ui)
│   ├── integrations/     # Third-party integration wrappers (e.g. better-auth header)
│   └── routes/           # TanStack Router file-based routes
├── drizzle/              # Migration SQL files
└── public/               # Static assets
```

## Conventions

- **No build step for library packages** — `main` and `exports` point directly to `src/index.ts`. Consumers (the todo app) bundle via Vite.
- **ESM imports use `.js` extensions** — even when importing `.ts` files (e.g. `import { foo } from "./bar.js"`).
- **One model per file** — each entity gets its own `defineModel()` call in `src/lib/`.
- **`index.ts` is the public API** — only explicitly exported symbols are considered public.
- **Test file co-location** — tests live next to the source file they test, not in a separate `__tests__` directory.
- **Property tests are separate files** — `*.property.test.ts` files contain only `fast-check` property tests; unit tests stay in `*.test.ts`.
- **Workspace dependencies** — internal packages reference each other via `"workspace:*"` in `package.json`.
