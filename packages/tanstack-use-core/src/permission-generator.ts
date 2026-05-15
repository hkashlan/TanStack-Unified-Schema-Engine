import { createAccessControl } from "better-auth/plugins";
import type { Model } from "./types.js";

export const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

/**
 * Converts the model registry into a Better Auth AC statement object.
 * Each model name becomes a resource key with the four CRUD actions.
 *
 * @example
 * // models has "todos" and "posts"
 * generatePermissions(models)
 * // → { todos: ["create","read","update","delete"], posts: [...] }
 */
export function generatePermissions(
  models: Record<string, Model<any, any>>,
): Record<string, readonly CrudAction[]> {
  const statement: Record<string, readonly CrudAction[]> = {};
  for (const name of Object.keys(models)) {
    statement[name] = CRUD_ACTIONS;
  }
  return statement;
}

/**
 * Builds a Better Auth AccessControl instance from the model registry.
 * The returned instance is passed as the `ac` option to `organization()`.
 */
export function buildAc(models: Record<string, Model<any, any>>) {
  const statement = generatePermissions(models);
  return createAccessControl(statement as Parameters<typeof createAccessControl>[0]);
}
