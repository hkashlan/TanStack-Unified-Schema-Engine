import {  defineApp } from "@tanstack-use/core";
import { getBaseRouter } from "@tanstack-use/ui/server";
import { todoModel } from "./lib/model";
import { routeTree } from "./routeTree.gen";

// `app` is the typed singleton — `app.models.todo` autocompletes correctly.
// The module augmentation below makes `appClient.models.todo` work everywhere.
export const app = defineApp({
	models: { todo: todoModel },
});



// Register the app type globally so `appClient` is fully typed everywhere
declare module "@tanstack-use/core" {
	interface Register {
		app: typeof app;
	}
}

export function getRouter() {
	return getBaseRouter(routeTree, app);
}
