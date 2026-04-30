import { createFileRoute } from "@tanstack/react-router";
import { ListPage } from "@tanstack-use/ui";
import { todoModel } from "#/lib/model";

export const Route = createFileRoute("/todos/")({
  component: () => <ListPage model={todoModel} />,
});
