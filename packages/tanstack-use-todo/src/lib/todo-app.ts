import { defineApp } from "@tanstack-use/core";
import { auth } from "./auth.js";
import { todoModel } from "./model.js";

export const todoApp = defineApp({ models: [todoModel], auth: auth as any });
