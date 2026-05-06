import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Route as rootRouteImport } from "./routes/__root";
import { createAuthRoute } from "@tanstack-use/permissions/server";

// `auth` is imported lazily so the `pg` dependency is never statically
// analysed by Vite when building the client bundle.
const getAuth = () =>
  import("@tanstack-use/permissions/auth").then((m) => m.auth);


export function getRouter() {
  const authRoute = createAuthRoute(rootRouteImport, {
    handler: async (req: Request) => {
      const auth = await getAuth();
      return auth.handler(req);
    },
  });


  let children = routeTree.children as unknown as Array<{path: string}>;
  children = children.filter(child => child.path === authRoute.path)
  
  const finalRouteTree = routeTree.addChildren([...children as any, authRoute]);
    const router = createTanStackRouter({
    routeTree: finalRouteTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
