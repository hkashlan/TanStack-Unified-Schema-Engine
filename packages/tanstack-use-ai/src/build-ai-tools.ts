/**
 * buildAITools — derives TanStack AI tool definitions from the App registry.
 *
 * For each model and each operation (list, create, update, delete), the
 * function calls `can(session, target, auth, app)` and registers a TanStack AI
 * `toolDefinition` only for permitted operations.
 *
 * Each tool's execute function calls the corresponding server function and
 * returns the result to the AI agent.
 *
 * Requirements: 13.1, 13.2, 13.4, 13.8
 */

import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { can } from "@tanstack-use/permissions";
import type { BetterAuthInstance } from "@tanstack-use/permissions";
import type { App } from "@tanstack-use/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four operations that can be exposed as AI tools. */
export type AIOperation = "list" | "create" | "update" | "delete";

/**
 * Minimal interface for the server functions object produced by
 * `createServerFunctions(app, db, auth)` from `@tanstack-use/ui`.
 *
 * We accept a structural type here so that `tanstack-use-ai` does not need
 * to depend on `tanstack-use-ui` (which would create a circular dependency).
 */
export interface AIServerFunctions {
  list: (args: { tableName: string; search?: string }) => Promise<unknown[]>;
  create: (args: { tableName: string; record: Record<string, unknown> }) => Promise<unknown>;
  update: (args: {
    tableName: string;
    id: string | number;
    record: Record<string, unknown>;
  }) => Promise<unknown>;
  remove: (args: { tableName: string; id: string | number }) => Promise<void>;
}

/** A record of TanStack AI tool definitions keyed by tool name. */
export type AITools = Record<string, ReturnType<typeof toolDefinition>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capitalise the first character of a string. */
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// buildAITools
// ---------------------------------------------------------------------------

/**
 * Derives TanStack AI tool definitions from the App registry.
 *
 * Only generates tools for operations the session's member is permitted to
 * perform, as determined by `can()`. This ensures the AI agent cannot attempt
 * what the user cannot do (Requirement 13.8).
 *
 * @param app        - The App registry produced by `defineApp()`
 * @param session    - The current Better Auth session
 * @param auth       - The permissions adapter created by `createPermissionsAdapter()`
 * @param serverFns  - The server functions produced by `createServerFunctions(app, db, auth)`
 * @returns          A record of TanStack AI tool definitions keyed by tool name
 *
 * @example
 * ```typescript
 * const tools = await buildAITools(app, session, auth, serverFns);
 * // tools may contain: listEmployee, createEmployee, updateEmployee, deleteEmployee
 * ```
 */
export async function buildAITools(
  app: App,
  session: unknown,
  auth: BetterAuthInstance,
  serverFns: AIServerFunctions,
): Promise<AITools> {
  const tools: AITools = {};

  for (const [tableName, _model] of app.models) {
    const operations: AIOperation[] = ["list", "create", "update", "delete"];

    for (const operation of operations) {
      // Map AI operation names to permission keys:
      //   "list"   → "read"   (list is a read operation)
      //   "create" → "create"
      //   "update" → "update"
      //   "delete" → "delete"
      // The server function for "delete" is called "remove" — handled in the executor.
      const permissionKey = operation === "list" ? "read" : operation;
      const permissionTarget = `${tableName}.${permissionKey}`;

      let permitted: boolean;
      try {
        permitted = await can(session, permissionTarget, auth, app);
      } catch {
        // Unknown model or other error — skip this operation
        permitted = false;
      }

      if (!permitted) continue;

      const toolName = `${operation}${capitalize(tableName)}`;

      // ------------------------------------------------------------------
      // Build per-operation tool definitions
      // ------------------------------------------------------------------

      if (operation === "list") {
        tools[toolName] = toolDefinition({
          name: toolName,
          description: `List ${tableName} records. Optionally filter by a search term.`,
          inputSchema: z.object({
            search: z.string().optional().describe("Optional search/filter term"),
          }),
          outputSchema: z.array(z.record(z.unknown())),
        }).server(async (args) => {
          const records = await serverFns.list({ tableName, search: args.search });
          return records as Record<string, unknown>[];
        });
      } else if (operation === "create") {
        tools[toolName] = toolDefinition({
          name: toolName,
          description: `Create a new ${tableName} record with the provided fields.`,
          inputSchema: z.object({
            record: z.record(z.unknown()).describe(`Fields for the new ${tableName} record`),
          }),
          outputSchema: z.record(z.unknown()),
        }).server(async (args) => {
          const result = await serverFns.create({
            tableName,
            record: args.record as Record<string, unknown>,
          });
          return result as Record<string, unknown>;
        });
      } else if (operation === "update") {
        tools[toolName] = toolDefinition({
          name: toolName,
          description: `Update an existing ${tableName} record by id.`,
          inputSchema: z.object({
            id: z.union([z.string(), z.number()]).describe(`ID of the ${tableName} record to update`),
            record: z.record(z.unknown()).describe("Fields to update"),
          }),
          outputSchema: z.record(z.unknown()),
        }).server(async (args) => {
          const result = await serverFns.update({
            tableName,
            id: args.id,
            record: args.record as Record<string, unknown>,
          });
          return result as Record<string, unknown>;
        });
      } else if (operation === "delete") {
        tools[toolName] = toolDefinition({
          name: toolName,
          description: `Delete a ${tableName} record by id.`,
          inputSchema: z.object({
            id: z.union([z.string(), z.number()]).describe(`ID of the ${tableName} record to delete`),
          }),
          outputSchema: z.object({ success: z.boolean() }),
        }).server(async (args) => {
          await serverFns.remove({ tableName, id: args.id });
          return { success: true };
        });
      }
    }
  }

  return tools;
}
