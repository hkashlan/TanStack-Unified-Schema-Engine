import type { Model, App } from "./types.js";
import { appClient } from "./client.js";

export interface AppConfig<TModels extends Record<string, Model<any, any>>> {
  models: TModels;
}

/**
 * Registers all models into the global `appClient` registry and returns a
 * fully-typed `App<TModels>` instance.
 *
 * **For full type safety everywhere**, augment the `Register` interface after
 * calling `defineApp`. This makes `appClient.models.yourModel` autocomplete
 * throughout your entire app without needing to import the `app` export.
 *
 * @example
 * ```ts
 * // src/router.tsx or src/lib/app.ts
 * export const app = defineApp({ models: { todo: todoModel, post: postModel } });
 *
 * declare module "@tanstack-use/core" {
 *   interface Register {
 *     app: typeof app;
 *   }
 * }
 *
 * // Now everywhere in your app:
 * import { appClient } from "@tanstack-use/core";
 * appClient.models.todo  // ✓ autocompletes
 * appClient.models.post  // ✓ autocompletes
 * ```
 *
 * Throws if two models share the same key.
 */
export function defineApp<TModels extends Record<string, Model<any, any>>>(
  config: AppConfig<TModels>,
): App<TModels> {
  // Validate for duplicate keys (keys are already unique in a plain object,
  // but we keep the check to catch accidental re-registrations at runtime).
  const seen = new Set<string>();
  for (const key of Object.keys(config.models)) {
    if (seen.has(key)) {
      throw new Error(`Duplicate model key: ${key}`);
    }
    seen.add(key);
  }
  // Mutate the shared singleton so all importers see the updated registry.
  // Cast to any to allow the mutation — at runtime it's the same object.
  // The return type is correctly typed as App<TModels>.
  (appClient as any).models = config.models;

  return appClient as any as App<TModels>;
}
