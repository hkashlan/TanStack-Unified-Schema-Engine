/**
 * Server-only entry point for @tanstack-use/ui.
 *
 * Import from "@tanstack-use/ui/server" inside "use server" files only.
 * Never import this from client components — it pulls in drizzle-orm and pg.
 */
export { serverFns } from "./server.functions.js";
export type {
  ModelServerFns,
  ListInput,
  GetInput,
  CreateInput,
  UpdateInput,
  RemoveInput,
  DbRow,
} from "./server.functions.js";
