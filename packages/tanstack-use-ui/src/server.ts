/**
 * Server-only entry point for @tanstack-use/ui.
 *
 * Import from "@tanstack-use/ui/server" inside "use server" files only.
 * Never import this from client components — it pulls in drizzle-orm and pg.
 */

export type {
  CreateInput,
  DbRow,
  GetInput,
  ListInput,
  ModelServerFns,
  RemoveInput,
  UpdateInput,
} from "./server.functions.js";
export { serverFns } from "./server.functions.js";
