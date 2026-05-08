import { createAuthClient } from "better-auth/react";
import type { App } from "./types.js";

/**
 * Client-safe singleton.
 *
 * Holds the model registry populated by `defineApp()` and the Better Auth
 * client instance. Safe to import in browser and React contexts.
 *
 * @example
 * ```ts
 * import { appClient } from "@tanstack-use/core/client";
 *
 * const model = appClient.models.get("todos");
 * const { data: session } = appClient.auth.useSession();
 * ```
 */
export const appClient: App = {
  _tag: "App",
  models: new Map(),
  auth: createAuthClient(),
};
