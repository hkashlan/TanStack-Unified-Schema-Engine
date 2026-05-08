import { createFileRoute } from "@tanstack/react-router";
import { ListPage } from "@tanstack-use/ui";
import { todoModel } from "#/lib/model";
import { todoServerFns } from "#/lib/server-fns";
import { authClient } from "@tanstack-use/permissions";

export const Route = createFileRoute("/_authenticated/todos/")({
  component: function TodoListPage() {
    const { data: session } = authClient.useSession();
    return (
      <ListPage
        model={todoModel}
        serverFns={todoServerFns}
        session={session}
      />
    );
  },
});
