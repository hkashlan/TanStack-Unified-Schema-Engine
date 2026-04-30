import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@tanstack-use/ui";
import { todoModel } from "#/lib/model";

export const Route = createFileRoute("/todos/$id")({
  component: function TodoDetailPage() {
    const { id } = Route.useParams();
    return <DetailPage model={todoModel} id={id} />;
  },
});
