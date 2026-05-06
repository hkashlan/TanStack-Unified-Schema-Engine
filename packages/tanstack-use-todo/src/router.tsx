import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createAuthRoute } from "@tanstack-use/permissions/server";

// `auth` is imported lazily so the `pg` dependency is never statically
// analysed by Vite when building the client bundle.
const getAuth = () =>
  import("@tanstack-use/permissions/auth").then((m) => m.auth);


export function getRouter() {
  const authRoute = createAuthRoute(routeTree, {
    handler: async (req: Request) => {
      const auth = await getAuth();
      return auth.handler(req);
    },
  });

  // Filter out the file-based version of the auth route to prevent the ID conflict
  const existingChildren = (routeTree.children as unknown as [] || []).filter(
    (child) => child['id'] !== '/api/auth/$'
  );

  const finalTree = routeTree.addChildren([
    ...existingChildren,
    authRoute
  ]);

  const router = createTanStackRouter({
    routeTree: finalTree,
    // ... rest of config
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
