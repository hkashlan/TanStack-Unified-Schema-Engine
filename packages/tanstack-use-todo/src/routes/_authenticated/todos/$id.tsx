import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@tanstack-use/ui";

export const Route = createFileRoute("/_authenticated/todos/$id")({
  component: function TodoDetailPage() {
    const { id } = Route.useParams();
    const { session } = Route.useRouteContext();
    return (
      <DetailPage
        modelKey={'todo'}
        id={id}
        session={session}
      />
    );
  },
});
