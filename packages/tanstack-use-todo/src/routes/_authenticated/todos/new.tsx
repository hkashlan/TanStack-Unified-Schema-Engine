"use server";
import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@tanstack-use/ui";
import { createModelServerFns } from "@tanstack-use/ui/server";
import { todoModel } from "#/lib/model";
import { todoApp } from "#/lib/todo-app";
import { authClient } from "@tanstack-use/permissions";

const serverFns = createModelServerFns(todoApp, process.env.DATABASE_URL!);

export const Route = createFileRoute("/_authenticated/todos/new")({
  component: function TodoCreatePage() {
    const { data: session } = authClient.useSession();
    return (
      <CreatePage
        model={todoModel}
        serverFns={serverFns}
        session={session}
        app={todoApp}
      />
    );
  },
});
