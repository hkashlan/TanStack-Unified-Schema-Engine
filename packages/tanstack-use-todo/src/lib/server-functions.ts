"use server";
import { createServerFunctions } from "@tanstack-use/ui";
import { todoApp } from "./todo-app.js";
import { db } from "./db.js";

export const todoServerFunctions = createServerFunctions(todoApp, db);
