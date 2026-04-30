import { defineModel } from "@tanstack-use/core";
import { todosTable } from "./schema.js";

export const todoModel = defineModel(todosTable, {
  fields: {
    title: {
      label: () => "Title",
      validate: (value) =>
        !value || String(value).trim() === "" ? "Title is required" : undefined,
    },
    completed: {
      label: () => "Completed",
    },
    createdAt: {
      label: () => "Created At",
    },
  },
  computedFields: {
    title1 : {
      compute: r => r.title,
      dependsOn: ['title']
    }
  },
  layout: {
    list: ["title", "completed", "title2"],
    detail: [
      {
        label: "Details",
        rows: [["title"], ["completed"], ["createdAt"]],
      },
    ],
    create: ["title"],
  },
  server: {
    beforeCreate: async ({ record, session }) => {
      (record as Record<string, unknown>).userId = session.userId;
    },
  },
});
