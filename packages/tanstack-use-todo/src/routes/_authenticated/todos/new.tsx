import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@tanstack-use/ui";

export const Route = createFileRoute("/_authenticated/todos/new")({
	component: function TodoCreatePage() {
		const { session } = Route.useRouteContext();
		return <CreatePage modelKey={"todo"} session={session} />;
	},
});
