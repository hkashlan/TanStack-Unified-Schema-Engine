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

// Auth guard
export { createAuthBeforeLoad } from "./auth-guard.js";
export type { AuthBeforeLoadOptions } from "./auth-guard.js";
