import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@tanstack-use/ui";
import { todoModel } from "#/lib/model";
import { todoServerFns } from "#/lib/server-fns";
import { authClient } from "@tanstack-use/permissions";

export const Route = createFileRoute("/_authenticated/todos/new")({
  component: function TodoCreatePage() {
    const { data: session } = authClient.useSession();
    return (
      <CreatePage
        model={todoModel}
        serverFns={todoServerFns}
        session={session}
      />
    );
  },
});
