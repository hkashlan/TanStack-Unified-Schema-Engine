import { createRoute, createRouter,   type AnyRoute } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import type { SessionClient } from "@tanstack-use/core/client";
import type { App } from "@tanstack-use/core";

export function createAuthRoute(
  rootRoute: AnyRoute,
  auth: { handler: (req: Request) => Response | Promise<Response> },
): AnyRoute {
  // `server.handlers` is a TanStack Start feature. The public RouteOptions type
  // doesn't expose it for code-based routes, but the runtime carries it through
  // when the route is added via routeTree.addChildren([...]).
  return createRoute({
    getParentRoute: () => rootRoute,
    path: "/api/auth/$",
    server: {
      handlers: {
        GET: ({ request }: { request: Request }) => auth.handler(request),
        POST: ({ request }: { request: Request }) => auth.handler(request),
      },
    },
  } as Parameters<typeof createRoute>[0]) as AnyRoute;
}


export interface MyRouterContext {
  queryClient: QueryClient;
  session: SessionClient | null; // Make it nullable for logged-out states
}

const getAuth = () =>
  import("@tanstack-use/core/server").then((m) => m.appServer.auth);

export function getBaseRouter(routeTree: AnyRoute, _app: App) {
  
  const queryClient = new QueryClient();

  const authRoute = createAuthRoute(routeTree, {
    handler: async (req: Request) => {
      const auth = await getAuth();
      return auth.handler(req);
    },
  });

  // Add the programmatic auth API route alongside the existing file-based routes.
  // We spread the existing children first so they are preserved, then append
  // the auth route. The filter guards against a duplicate if a file-based
  // /api/auth/$ route ever gets generated.
  const existingChildren = ((routeTree.children as unknown as AnyRoute[]) ?? []).filter(
    (child) => (child as unknown as { id: string }).id !== "/api/auth/$",
  );

  const finalTree = routeTree.addChildren([...existingChildren, authRoute]);

  const router = createRouter({
    routeTree: finalTree,
    context: { queryClient, session: null },
  });

  return router;
}