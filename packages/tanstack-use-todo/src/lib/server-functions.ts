"use server";
import { createServerFunctions } from "@tanstack-use/ui/server";
import { createPermissionsAdapter } from "@tanstack-use/permissions/server";
import { todoApp } from "./todo-app.js";
import { db } from "./db.js";

const auth = createPermissionsAdapter(db);
const fns = createServerFunctions(todoApp, db, auth);

// Export each server function individually so TanStack Start's compiler can
// replace each one with an RPC stub on the client bundle.
export const listRecords = fns.list;
export const getRecord = fns.get;
export const createRecord = fns.create;
export const updateRecord = fns.update;
export const removeRecord = fns.remove;
