import { defineApp } from "@tanstack-use/core";
import { todoModel } from "./model.js";

export const todoApp = defineApp({
  models: [todoModel],
});
