import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@tanstack-use/ui";

export const Route = createFileRoute("/_authenticated/todos/new")({
  component: function TodoCreatePage() {
    return (
      <CreatePage
        tableName={'todos'}
      />
    );
  },
});
