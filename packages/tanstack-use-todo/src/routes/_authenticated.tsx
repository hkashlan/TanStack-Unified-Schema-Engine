import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createAuthBeforeLoad } from "@tanstack-use/ui";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: createAuthBeforeLoad({
    getSession: () => authClient.getSession(),
    loginPath: "/demo/better-auth",
  }),
  component: () => <Outlet />,
});
