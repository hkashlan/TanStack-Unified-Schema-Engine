import {
  createRoute,
  type AnyRoute,
  type AnyRootRoute,
} from "@tanstack/react-router";
import type { PgTable } from "drizzle-orm/pg-core";
import type { App, Model } from "../../tanstack-use-core/src/types.js";

// ---------------------------------------------------------------------------
// Internal intermediate type — used by tests and internal helpers
// ---------------------------------------------------------------------------

/**
 * Plain descriptor of a route before it is bound to a TanStack Router root.
 * Useful for testing route generation logic without a full router setup.
 */
export interface RouteDescriptor {
  /** URL path segment, e.g. "/employee", "/employee/$id", "/employee/new" */
  path: string;
  /** The kind of page this route represents */
  type: "list" | "detail" | "create";
  /** The model this route belongs to */
  model: Model<PgTable>;
}

// ---------------------------------------------------------------------------
// Internal helper — builds RouteDescriptors from an App (no router dep)
// ---------------------------------------------------------------------------

/**
 * Returns plain route descriptors for every model in the App.
 * A descriptor is only created when the corresponding `ui.layout` section is
 * defined — this is the sole mechanism that controls page existence
 * (Requirements 1.5 – 1.8).
 *
 * @internal — prefer `createRoutes` for production use.
 */
export function buildRouteDescriptors(app: App): RouteDescriptor[] {
  const descriptors: RouteDescriptor[] = [];

  for (const model of Object.values(app.models)) {
    const tableName = (model.table as unknown as Record<symbol, unknown>)[
      Symbol.for("drizzle:Name")
    ] as string;

    if (model.ui.layout?.list !== undefined) {
      descriptors.push({ path: `/${tableName}`, type: "list", model });
    }

    if (model.ui.layout?.detail !== undefined) {
      descriptors.push({ path: `/${tableName}/$id`, type: "detail", model });
    }

    if (model.ui.layout?.create !== undefined) {
      descriptors.push({ path: `/${tableName}/new`, type: "create", model });
    }
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Public API — returns real TanStack Router route instances
// ---------------------------------------------------------------------------

/**
 * Generates TanStack Router route instances for every model registered in the
 * App, parented to the provided `rootRoute`.
 *
 * Routes are only created when the corresponding `ui.layout` section is
 * defined — layout presence is the sole mechanism controlling page existence
 * (Requirements 1.5 – 1.8).
 *
 * Route paths follow the convention:
 *   - list:   `/{tableName}`
 *   - detail: `/{tableName}/$id`   (param: `$id`)
 *   - create: `/{tableName}/new`
 *
 * The table name is read from `model.table[Symbol.for("drizzle:Name")]`.
 *
 * ### Usage
 *
 * ```typescript
 * import { createRootRoute, createRouter } from "@tanstack/react-router";
 * import { createRoutes } from "@tanstack-use/ui";
 *
 * const rootRoute = createRootRoute();
 * const routes = createRoutes(app, rootRoute);
 * const routeTree = rootRoute.addChildren(routes);
 * const router = createRouter({ routeTree });
 *
 * // Register for type-safe navigation across the whole project:
 * declare module "@tanstack/react-router" {
 *   interface Register { router: typeof router }
 * }
 * ```
 *
 * After the `Register` declaration, `<Link to="/employee">` and
 * `navigate({ to: "/employee/$id", params: { id: "1" } })` are fully
 * type-checked — typos and missing params become compile errors.
 */
export function createRoutes(app: App, rootRoute: AnyRootRoute): AnyRoute[] {
  return buildRouteDescriptors(app).map((descriptor) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: descriptor.path,
      // Components are wired in later tasks (ListPage, DetailPage, CreatePage).
      // The route context carries the model so page components can access it.
      context: () => ({ model: descriptor.model, routeType: descriptor.type }),
    }),
  );
}
