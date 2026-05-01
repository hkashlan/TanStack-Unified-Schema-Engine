// tanstack-use-ui entry point

// Route generation
export { buildRouteDescriptors, createRoutes } from "./create-routes.js";
export type { RouteDescriptor } from "./create-routes.js";

// Label resolution
export { resolveLabel } from "./label-resolver.js";

// Page components
export { ListPage } from "./components/ListPage.js";
export type { ListPageProps } from "./components/ListPage.js";

export { DetailPage, FieldDisplay } from "./components/DetailPage.js";
export type { DetailPageProps } from "./components/DetailPage.js";

export { CreatePage, FieldInput, FileFieldInput } from "./components/CreatePage.js";
export type { CreatePageProps } from "./components/CreatePage.js";

// Server functions — types only in the barrel; the implementation is server-only.
// Import createServerFunctions directly from "@tanstack-use/ui/src/server-functions.js"
// inside a "use server" file — never from this barrel in client code.
export type { ServerFunctions, ListInput, GetInput, CreateInput, UpdateInput, RemoveInput, DbRow } from "./server-functions.js";

// Server functions context provider and hook
export {
  ServerFunctionsProvider,
  useServerFunctions,
  ServerFunctionsContext,
} from "./server-functions-context.js";
export type { ServerFunctionsProviderProps } from "./server-functions-context.js";

// Auth guard
export { createAuthBeforeLoad } from "./auth-guard.js";
export type { AuthBeforeLoadOptions } from "./auth-guard.js";
