import { type AnyRoute, createRoute, useParams, useRouteContext } from "@tanstack/react-router";
import type { PgTable } from "drizzle-orm/pg-core";
import type React from "react";
import type { App, Model, RegisteredApp } from "@tanstack-use/core";
import type { SessionClient } from "@tanstack-use/core/client";
import { CreatePage } from "./components/CreatePage.js";
import { DetailPage } from "./components/DetailPage.js";
import { ListPage } from "./components/ListPage.js";

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

  for (const [modelKey, model] of Object.entries(app.models)) {
    if (model.ui.layout?.list !== undefined) {
      descriptors.push({ path: `/${modelKey}`, type: "list", model });
    }

    if (model.ui.layout?.detail !== undefined) {
      descriptors.push({ path: `/${modelKey}/$id`, type: "detail", model });
    }

    if (model.ui.layout?.create !== undefined) {
      descriptors.push({ path: `/${modelKey}/new`, type: "create", model });
    }
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Public API — returns real TanStack Router route instances
// ---------------------------------------------------------------------------

/**
 * Generates TanStack Router route instances for every model registered in the
 * App, parented to the provided authenticated route.
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
 * In `getBaseRouter()` or within TanStack Start setup:
 *
 * ```typescript
 * import { createRoutes, getBaseRouter } from "@tanstack-use/ui/server";
 *
 * // getBaseRouter handles model route generation + assembly automatically:
 * const router = getBaseRouter(routeTree, app);
 *
 * // Register for type-safe navigation across the whole project:
 * declare module "@tanstack/react-router" {
 *   interface Register { router: Awaited<ReturnType<typeof getBaseRouter>> }
 * }
 * ```
 *
 * After the `Register` declaration, `<Link to="/todo">` and
 * `navigate({ to: "/todo/$id", params: { id: "1" } })` are fully
 * type-checked — typos and missing params become compile errors.
 */
export function createRoutes(
  app: App,
  authenticatedRoute: AnyRoute,
): AnyRoute[] {
  return buildRouteDescriptors(app).map((descriptor): AnyRoute => {
    const modelKey = Object.entries(app.models).find(
      ([_, m]) => m === descriptor.model,
    )?.[0];

    if (!modelKey) {
      throw new Error("Model not found in app");
    }

    switch (descriptor.type) {
      case "list": {
        return createRoute({
          getParentRoute: () => authenticatedRoute,
          path: descriptor.path,
          component: ListPageRouteComponent.bind(
            null,
            modelKey as keyof RegisteredApp["models"],
          ),
        });
      }

      case "detail": {
        return createRoute({
          getParentRoute: () => authenticatedRoute,
          path: descriptor.path,
          component: DetailPageRouteComponent.bind(
            null,
            modelKey as keyof RegisteredApp["models"],
          ),
        });
      }

      case "create": {
        return createRoute({
          getParentRoute: () => authenticatedRoute,
          path: descriptor.path,
          component: CreatePageRouteComponent.bind(
            null,
            modelKey as keyof RegisteredApp["models"],
          ),
        });
      }

      default: {
        const exhaustiveCheck: never = descriptor.type;
        throw new Error(`Unhandled route type: ${exhaustiveCheck}`);
      }
    }
  });
}

// Route component wrappers that use hooks
function ListPageRouteComponent(
  modelKey: keyof RegisteredApp["models"],
): React.ReactElement {
  const { session } = useRouteContext({ strict: false }) as { session: SessionClient };
  return <ListPage modelKey={modelKey} session={session} />;
}

function DetailPageRouteComponent(
  modelKey: keyof RegisteredApp["models"],
): React.ReactElement {
  const { session } = useRouteContext({ strict: false }) as { session: SessionClient };
  const { id } = useParams({ from: "$" }) as { id: string };
  return <DetailPage modelKey={modelKey} id={id} session={session} />;
}

function CreatePageRouteComponent(
  modelKey: keyof RegisteredApp["models"],
): React.ReactElement {
  const { session } = useRouteContext({ strict: false }) as { session: SessionClient };
  return <CreatePage modelKey={modelKey} session={session} />;
}
