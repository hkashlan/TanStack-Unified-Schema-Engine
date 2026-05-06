import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createAuthBeforeLoad } from "@tanstack-use/ui";
import { authClient } from "@tanstack-use/permissions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: createAuthBeforeLoad({
    getSession: () => authClient.getSession(),
    loginPath: "/demo/better-auth",
  }),
  component: () => <Outlet />,
});
