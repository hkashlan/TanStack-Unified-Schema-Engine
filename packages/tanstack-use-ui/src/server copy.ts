/**
 * Server-only entry point for @tanstack-use/ui.
 *
 * Import from "@tanstack-use/ui/server" inside "use server" files only.
 * Never import this from client components — it pulls in drizzle-orm and pg.
 */

import { QueryClient } from "@tanstack/react-query";
import { type AnyRoute, createRouter } from "@tanstack/react-router";
import type { App } from "@tanstack-use/core";
import { createAuthRoute } from "@tanstack-use/permissions";
import { createRoutes } from "./create-routes.js";

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

const processedKey = Symbol.for("@tanstack-use/ui:getBaseRouter:processed");
type ProcessedRoute = AnyRoute & { [processedKey]?: boolean };

export function getBaseRouter(routeTree: AnyRoute, app: App) {
  const queryClient = new QueryClient();
  const rt = routeTree as ProcessedRoute;

  // getBaseRouter is called multiple times (SSR + client hydration).
  // addChildren mutates in place, so only mutate once per route tree instance.
  if (!rt[processedKey]) {
    const rootChildren = (routeTree.children as unknown as AnyRoute[]) ?? [];

    const authParent =
      rootChildren.find(
        (child) => (child as unknown as { id?: string }).id === "/_authenticated",
      ) ?? null;

    if (authParent) {
      const existingAuthChildren =
        (authParent.children as unknown as AnyRoute[]) ?? [];
      const existingPaths = new Set(
        existingAuthChildren
          .map((route) => (route as unknown as { path?: string }).path ?? "")
          .filter(Boolean),
      );

      const modelRoutes = createRoutes(app, authParent).filter((route) => {
        const path = (route as unknown as { path?: string }).path ?? "";
        return path !== "" && !existingPaths.has(path);
      });

      if (modelRoutes.length > 0) {
        authParent.addChildren(modelRoutes);
      }
    }

    const hasAuthApiRoute = rootChildren.some(
      (child) => (child as unknown as { path?: string }).path === "/api/auth/$",
    );

    if (!hasAuthApiRoute) {
      const authRoute = createAuthRoute(routeTree, {
        handler: async (req: Request) => {
          const auth = await import("@tanstack-use/core/server").then(
            (m) => m.appServer.auth,
          );
          return auth.handler(req);
        },
      });
      routeTree.addChildren([authRoute]);
    }

    rt[processedKey] = true;
  }

  return createRouter({
    routeTree,
    context: { queryClient, session: null },
  });
}
