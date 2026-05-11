import { createRouter, type AnyRoute } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { createAuthRoute } from "@tanstack-use/permissions/server";
import { appClient, defineApp } from "@tanstack-use/core";
import { todoModel } from "./lib/model";

// `app` is the typed singleton — `app.models.todo` autocompletes correctly.
// The module augmentation below makes `appClient.models.todo` work everywhere.
export const app = defineApp({
  models: { todo: todoModel },
});

// Register the app type globally so `appClient` is fully typed everywhere
declare module "@tanstack-use/core" {
  interface Register {
    app: typeof app;
  }
}
appClient
// `auth` is imported lazily so the `pg` dependency is never statically
// analysed by Vite when building the client bundle.
const getAuth = () =>
  import("@tanstack-use/core/server").then((m) => m.appServer.auth);

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
  const existingChildren = ((routeTree.children as unknown as AnyRoute[]) ?? []).filter(
    (child) => (child as unknown as { id: string }).id !== "/api/auth/$",
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