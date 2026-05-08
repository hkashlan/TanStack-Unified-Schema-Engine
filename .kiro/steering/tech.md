# Tech Stack

## Language & Runtime
- **TypeScript** (strict mode, ESNext/ES2022 target, `"type": "module"` throughout)
- **Node.js** with ESM — all imports use `.js` extensions even for `.ts` source files

## Core Libraries
| Concern | Library |
|---|---|
| Database schema & ORM | `drizzle-orm` (PostgreSQL via `pg`) |
| Routing | `@tanstack/react-router` |
| Server functions | `@tanstack/react-start` |
| Data fetching | `@tanstack/react-query` |
| Forms | TanStack Form |
| Tables | TanStack Table |
| Auth | `better-auth` (organization plugin for group-based permissions) |
| AI chatbot | `@tanstack/ai` |
| UI components | Shadcn/ui + Radix UI + Tailwind CSS v4 |
| Validation (AI pkg) | `zod` |

## Build & Tooling
| Tool | Purpose |
|---|---|
| `vite` | Bundler (app + packages) |
| `vitest` | Test runner |
| `fast-check` | Property-based testing |
| `tsd` | Type-level tests (`.test-d.ts` files) |
| `biome` | Linter + formatter (replaces ESLint + Prettier) |
| `drizzle-kit` | DB migrations |
| `tsx` | Running scripts (e.g. seed) |

## Code Style (Biome)
- 2-space indentation, 100-char line width
- Double quotes, trailing commas, semicolons always
- `noExplicitAny` is an error (relaxed in test files)
- `noUnusedVariables` and `noUnusedImports` are errors
- `useConst` enforced

## Common Commands

```bash
# From workspace root
pnpm test              # Run all tests once (vitest run)
pnpm test:watch        # Vitest in watch mode
pnpm typecheck         # tsc --noEmit across all packages
pnpm lint              # Biome lint
pnpm format            # Biome format (write)
pnpm check             # Biome check + fix (lint + format)

# From packages/tanstack-use-todo (or use --filter)
pnpm --filter @tanstack-use/todo dev     # Start dev server on port 3000
pnpm --filter @tanstack-use/todo build   # Production build
pnpm --filter @tanstack-use/todo seed    # Seed the database
pnpm --filter @tanstack-use/todo test    # Run todo app tests

# Installing dependencies
pnpm add <pkg>                                  # Add to current package
pnpm --filter @tanstack-use/todo add <pkg>      # Add to todo app specifically

# Database migrations (from packages/tanstack-use-todo)
pnpm dlx drizzle-kit generate   # Generate migration files
pnpm dlx drizzle-kit migrate    # Apply migrations
```

## Package Manager
- **`pnpm`** — used for all dependency management and script execution
- Use `pnpm --filter <package-name>` to run commands in a specific workspace package
- The todo app has `pnpm.onlyBuiltDependencies` config for native deps (`esbuild`, `lightningcss`)
