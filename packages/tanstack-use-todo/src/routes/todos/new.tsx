import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@tanstack-use/ui";
import { todoModel } from "#/lib/model";

export const Route = createFileRoute("/todos/new")({
  component: () => <CreatePage model={todoModel} />,
});
