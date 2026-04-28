import type { App } from "@tanstack-use/core";

/**
 * Evaluates whether the session's member can perform an operation on a model.
 *
 * @param session - The Better Auth session
 * @param target  - "ModelName.operation" e.g. "employee.read"
 * @param app     - The App registry
 * @returns true if the operation is permitted, false otherwise
 */
export async function can(session: unknown, target: string, app: App): Promise<boolean> {
  const dotIndex = target.indexOf(".");
  const modelName = dotIndex === -1 ? target : target.slice(0, dotIndex);
  const operation = dotIndex === -1 ? "" : target.slice(dotIndex + 1);

  const model = app.models.get(modelName);
  if (model === undefined) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  const allowedGroups: string[] =
    model.ui.permissions?.[operation as keyof typeof model.ui.permissions] ?? [];

  // Empty or absent permission array means unrestricted
  if (allowedGroups.length === 0) {
    return true;
  }

  const memberGroups: string[] = await app.auth.api.getActiveMemberGroups(session);

  return memberGroups.some((g) => allowedGroups.includes(g));
}
