import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createAuthBeforeLoad } from "@tanstack-use/ui";
import { appClient } from "@tanstack-use/core/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: createAuthBeforeLoad({
    getSession: () => appClient.auth.getSession(),
    loginPath: "/demo/better-auth",
  }),
  component: () => <Outlet />,
});
