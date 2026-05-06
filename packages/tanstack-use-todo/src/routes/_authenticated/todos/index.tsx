"use server";
import { createFileRoute } from "@tanstack/react-router";
import { ListPage } from "@tanstack-use/ui";
import { createModelServerFns } from "@tanstack-use/ui/server";
import { todoModel } from "#/lib/model";
import { todoApp } from "#/lib/todo-app";
import { authClient } from "@tanstack-use/permissions";

// createModelServerFns is called at module level so TanStack Start's compiler
// can statically replace each createServerFn call with an RPC stub.
const serverFns = createModelServerFns(todoApp, process.env.DATABASE_URL!);

export const Route = createFileRoute("/_authenticated/todos/")({
  component: function TodoListPage() {
    const { data: session } = authClient.useSession();
    return (
      <ListPage
        model={todoModel}
        serverFns={serverFns}
        session={session}
        app={todoApp}
      />
    );
  },
});
