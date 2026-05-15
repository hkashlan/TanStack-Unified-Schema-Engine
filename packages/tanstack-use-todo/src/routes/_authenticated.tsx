import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppRoot } from "../components/AppRoot.js";

// Layout route — wraps all authenticated pages. Model routes (list/detail/create)
// are added programmatically under this layout by getBaseRouter() in @tanstack-use/ui/server.
export const Route = createFileRoute("/_authenticated")({
	component: () => (
		<AppRoot>
			<Outlet />
		</AppRoot>
	),
});
