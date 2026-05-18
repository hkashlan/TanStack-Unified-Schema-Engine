/**
 * Server-only entry point for @tanstack-use/ui.
 *
 * Import from "@tanstack-use/ui/server" inside "use server" files only.
 * Never import this from client components — it pulls in drizzle-orm and pg.
 */

import { QueryClient } from "@tanstack/react-query";
import { type AnyRoute, createRouter } from "@tanstack/react-router";
import type { App } from "@tanstack-use/core";
import { createRoutes } from "./create-routes";
import { createAuthRoute } from "../../tanstack-use-permissions/src/create-auth-route.js";

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

const getAuth = () =>
  import("@tanstack-use/core/server").then((m) => m.appServer.auth);

export function getBaseRouter(routeTree: AnyRoute, app: App) {
  const queryClient = new QueryClient();

  const rootChildren =
    Array.isArray(routeTree.children) &&
    routeTree.children.filter((c) => c.id !== "/api/auth/$").length > 0
      ? (routeTree.children as unknown as AnyRoute[])
      : [routeTree];
  const authRoute = createAuthRoute(routeTree, {
    handler: async (req: Request) => {
      const auth = await getAuth();
      return auth.handler(req);
    },
  });

  // const authParent =
  //   rootChildren.find(
  //     (child) => (child as unknown as { id?: string }).id === "/",
  //   ) ?? rootChildren[0]!;

  const modelRoutes = createRoutes(app, routeTree);
  // authParent.addChildren(modelRoutes);
  const ids = modelRoutes.map(
    (route) => (route.options as unknown as { path: string }).path,
  );
  ids.push("/api/auth/$");

  // Add the programmatic auth API route alongside the existing file-based routes.
  // We spread the existing children first so they are preserved, then append
  // the auth route. The filter guards against a duplicate if a file-based
  // /api/auth/$ route ever gets generated.
  const existingChildren = (
    (routeTree.children as unknown as AnyRoute[]) ?? []
  ).filter(
    (child) =>
      !ids.includes((child as unknown as { id: string }).id) &&
      !ids.includes((child as unknown as { path: string }).path),
  );

  const finalTree = routeTree.addChildren([
    ...existingChildren,
    authRoute,
    ...modelRoutes,
  ]);

  const router = createRouter<typeof finalTree>({
    routeTree: finalTree,
    context: { queryClient, session: null },
  });

  return router;
}
