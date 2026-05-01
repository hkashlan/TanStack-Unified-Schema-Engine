"use server";
import { createServerFunctions } from "@tanstack-use/ui";
import { createPermissionsAdapter } from "@tanstack-use/permissions";
import { todoApp } from "./todo-app.js";
import { db } from "./db.js";

const auth = createPermissionsAdapter(db);
export const todoServerFunctions = createServerFunctions(todoApp, db, auth);
