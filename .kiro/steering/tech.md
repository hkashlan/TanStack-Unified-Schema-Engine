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
npm test              # Run all tests once (vitest run)
npm run test:watch    # Vitest in watch mode
npm run typecheck     # tsc --noEmit across all packages
npm run lint          # Biome lint
npm run format        # Biome format (write)
npm run check         # Biome check + fix (lint + format)

# From packages/tanstack-use-todo
npm run dev           # Start dev server on port 3000
npm run build         # Production build
npm run seed          # Seed the database
npm run test          # Run todo app tests

# Database migrations (from packages/tanstack-use-todo)
npx drizzle-kit generate   # Generate migration files
npx drizzle-kit migrate    # Apply migrations
```

## Package Manager
- `npm` with workspaces (root `package.json` manages the monorepo)
- The todo app also has `pnpm` config for built dependencies (`esbuild`, `lightningcss`)
