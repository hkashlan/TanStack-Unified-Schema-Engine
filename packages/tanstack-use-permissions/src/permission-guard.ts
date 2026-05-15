import { getModel, type RegisteredApp } from "@tanstack-use/core";
import { appServer } from "@tanstack-use/core/server";

/**
 * Evaluates whether the session's member can perform an operation on a model.
 *
 * @param session - The Better Auth session (with headers attached by TanStack Start middleware)
 * @param target  - "<modelName>:<operation>" e.g. "todo:delete"
 * @param auth    - The Better Auth server instance (optional; if absent and permissions are required, returns false)
 * @returns true if the operation is permitted, false otherwise
 */
export async function can(
  modelKey: keyof RegisteredApp["models"],
  target: string,
  headers: Headers,
): Promise<boolean> {
  const colonIndex = target.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(
      `Invalid permission target: "${target}". Expected format: "<model>:<operation>"`,
    );
  }

  const modelName = target.slice(0, colonIndex);
  const operation = target.slice(colonIndex + 1);

  const model = getModel(modelKey);
  if (model === undefined) {
    throw new Error(`Unknown model: "${modelName}"`);
  }

  const result = await appServer.hasPermission({
    headers,
    body: {
      permissions: { [modelName]: [operation] },
    },
  });

  return result.success === true;
}
