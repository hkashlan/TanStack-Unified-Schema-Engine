import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { createAuthRoute } from "@tanstack-use/permissions/server";
import { defineApp } from "@tanstack-use/core";
import { todoModel } from "./lib/model";


defineApp({
  models: [todoModel],
})
// `auth` is imported lazily so the `pg` dependency is never statically
// analysed by Vite when building the client bundle.
const getAuth = () =>
  import("@tanstack-use/permissions/auth").then((m) => m.auth);

export function getRouter() {
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
  const existingChildren = ((routeTree.children as unknown as Array<{ id: string }>) ?? []).filter(
    (child) => child.id !== "/api/auth/$",
  );

  const finalTree = routeTree.addChildren([...existingChildren, authRoute]);

  const router = createRouter({
    routeTree: finalTree,
    context: { queryClient },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    ssr: false;
    router: ReturnType<typeof getRouter>;
  }
  interface RouterContext {
    queryClient: QueryClient;
  }
}