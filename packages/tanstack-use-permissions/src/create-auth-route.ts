import { type AnyRoute, createRoute } from "@tanstack/react-router";

export interface MyRouterContext {
  queryClient: unknown; // from @tanstack/react-query
  session: unknown; // from @tanstack-use/core/client
}

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
