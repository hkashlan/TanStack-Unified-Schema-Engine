import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@tanstack-use/ui";
import { todoModel } from "#/lib/model";
import { todoServerFns } from "#/lib/server-fns";
import { authClient } from "@tanstack-use/permissions";

export const Route = createFileRoute("/_authenticated/todos/$id")({
  component: function TodoDetailPage() {
    const { id } = Route.useParams();
    const { data: session } = authClient.useSession();
    return (
      <DetailPage
        model={todoModel}
        id={id}
        serverFns={todoServerFns}
        session={session}
      />
    );
  },
});
