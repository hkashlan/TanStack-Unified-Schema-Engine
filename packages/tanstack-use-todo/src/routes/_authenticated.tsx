import { createFileRoute, Outlet } from "@tanstack/react-router";
// import { createAuthBeforeLoad } from "@tanstack-use/ui";
// import { appClient, SessionClient } from "@tanstack-use/core/client";

export const Route = createFileRoute("/_authenticated")({
	// beforeLoad: createAuthBeforeLoad({
	// 	loginPath: "/demo/better-auth",
	// }),
	component: () => <Outlet />,
});
