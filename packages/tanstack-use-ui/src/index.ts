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

// Server functions
export { createServerFunctions } from "./server-functions.js";
export type { ServerFunctions, ListInput, GetInput, CreateInput, UpdateInput, RemoveInput } from "./server-functions.js";

// Server functions context provider and hook
export {
  ServerFunctionsProvider,
  useServerFunctions,
  ServerFunctionsContext,
} from "./server-functions-context.js";
export type { ServerFunctionsProviderProps } from "./server-functions-context.js";
