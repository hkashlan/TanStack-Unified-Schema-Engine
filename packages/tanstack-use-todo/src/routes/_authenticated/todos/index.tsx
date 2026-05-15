import { createFileRoute } from "@tanstack/react-router";
import { ListPage } from "@tanstack-use/ui";

export const Route = createFileRoute("/_authenticated/todos/")({
	component: function TodoListPage() {
		const { session } = Route.useRouteContext();
		return <ListPage modelKey={"todo"} session={session} />;
	},
});
