import { createFileRoute, Outlet} from "@tanstack/react-router";
import { createAuthBeforeLoad } from "@tanstack-use/ui";
// import { appClient, SessionClient } from "@tanstack-use/core/client";


export const Route = createFileRoute("/_authenticated")({
  beforeLoad: createAuthBeforeLoad({
    loginPath: "/demo/better-auth",
  }),
  component: () => <Outlet />,
});

// export const Route = createFileRoute("/_authenticated")({
//   beforeLoad: ({ context }) => {
//     // 1. Runtime check: Redirect if null
//     if (!context.session) {
//       throw redirect({ to: "/demo/better-auth" });
//     }

//     // 2. Type narrowing: Tell TypeScript session is NOT null for children
//     return {
//       session: context.session,
//     };
//   },
//   component: () => <Outlet />,
// });