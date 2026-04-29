import { createRootRoute } from "@tanstack/react-router";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { defineApp } from "../../tanstack-use-core/src/define-app.js";
import { defineModel } from "../../tanstack-use-core/src/define-model.js";
import { buildRouteDescriptors, createRoutes } from "./create-routes.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockAuth = {
  api: { getActiveMemberGroups: async () => [] },
};

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const productTable = pgTable("product", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});

// ---------------------------------------------------------------------------
// buildRouteDescriptors — no layout → no descriptors
// ---------------------------------------------------------------------------

describe("buildRouteDescriptors() — no layout", () => {
  it("returns no descriptors when ui.layout is entirely absent", () => {
    const model = defineModel(employeeTable, {});
    const app = defineApp({ models: [model], auth: mockAuth });

    expect(buildRouteDescriptors(app)).toHaveLength(0);
  });

  it("returns no descriptors when ui.layout is an empty object", () => {
    const model = defineModel(employeeTable, { layout: {} });
    const app = defineApp({ models: [model], auth: mockAuth });

    expect(buildRouteDescriptors(app)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildRouteDescriptors — partial layout → only matching descriptors
// ---------------------------------------------------------------------------

describe("buildRouteDescriptors() — partial layout", () => {
  it("returns only the list descriptor when only ui.layout.list is defined", () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]?.type).toBe("list");
    expect(descriptors[0]?.path).toBe("/employee");
  });

  it("returns only the detail descriptor when only ui.layout.detail is defined", () => {
    const model = defineModel(employeeTable, {
      layout: { detail: [{ label: "Info", rows: [["name"]] }] },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]?.type).toBe("detail");
    expect(descriptors[0]?.path).toBe("/employee/$id");
  });

  it("returns only the create descriptor when only ui.layout.create is defined", () => {
    const model = defineModel(employeeTable, {
      layout: { create: ["name"] },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]?.type).toBe("create");
    expect(descriptors[0]?.path).toBe("/employee/new");
  });

  it("returns list and detail descriptors when both are defined but create is absent", () => {
    const model = defineModel(employeeTable, {
      layout: {
        list: ["id", "name"],
        detail: [{ label: "Info", rows: [["name"]] }],
      },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors).toHaveLength(2);
    const types = descriptors.map((d) => d.type);
    expect(types).toContain("list");
    expect(types).toContain("detail");
    expect(types).not.toContain("create");
  });
});

// ---------------------------------------------------------------------------
// buildRouteDescriptors — full layout → all three descriptors
// ---------------------------------------------------------------------------

describe("buildRouteDescriptors() — full layout", () => {
  it("returns all three descriptors when all layout sections are defined", () => {
    const model = defineModel(employeeTable, {
      layout: {
        list: ["id", "name"],
        detail: [{ label: "Info", rows: [["name"]] }],
        create: ["name"],
      },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors).toHaveLength(3);
    const types = descriptors.map((d) => d.type);
    expect(types).toContain("list");
    expect(types).toContain("detail");
    expect(types).toContain("create");
  });

  it("uses the Drizzle table name as the URL segment", () => {
    const model = defineModel(employeeTable, {
      layout: {
        list: ["id", "name"],
        detail: [{ label: "Info", rows: [["name"]] }],
        create: ["name"],
      },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    const paths = descriptors.map((d) => d.path);
    expect(paths).toContain("/employee");
    expect(paths).toContain("/employee/$id");
    expect(paths).toContain("/employee/new");
  });

  it("attaches the correct model reference to each descriptor", () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors[0]?.model).toBe(model);
  });
});

// ---------------------------------------------------------------------------
// buildRouteDescriptors — multiple models
// ---------------------------------------------------------------------------

describe("buildRouteDescriptors() — multiple models", () => {
  it("generates descriptors for each model independently", () => {
    const employeeModel = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
    });
    const productModel = defineModel(productTable, {
      layout: { list: ["id", "title"], create: ["title"] },
    });
    const app = defineApp({ models: [employeeModel, productModel], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    // 1 from employee (list) + 2 from product (list + create)
    expect(descriptors).toHaveLength(3);

    const employeeDescs = descriptors.filter((d) => d.path.startsWith("/employee"));
    const productDescs = descriptors.filter((d) => d.path.startsWith("/product"));

    expect(employeeDescs).toHaveLength(1);
    expect(productDescs).toHaveLength(2);
  });

  it("generates no descriptors for a model with no layout even when other models have routes", () => {
    const employeeModel = defineModel(employeeTable, {});
    const productModel = defineModel(productTable, {
      layout: { list: ["id", "title"] },
    });
    const app = defineApp({ models: [employeeModel, productModel], auth: mockAuth });
    const descriptors = buildRouteDescriptors(app);

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]?.path).toBe("/product");
  });
});

// ---------------------------------------------------------------------------
// createRoutes — returns real TanStack Router route instances
// ---------------------------------------------------------------------------

describe("createRoutes() — TanStack Router integration", () => {
  it("returns the same number of routes as buildRouteDescriptors", () => {
    const model = defineModel(employeeTable, {
      layout: {
        list: ["id", "name"],
        detail: [{ label: "Info", rows: [["name"]] }],
        create: ["name"],
      },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const rootRoute = createRootRoute();

    const routes = createRoutes(app, rootRoute);
    const descriptors = buildRouteDescriptors(app);

    expect(routes).toHaveLength(descriptors.length);
  });

  it("route paths match the descriptor paths", () => {
    const model = defineModel(employeeTable, {
      layout: {
        list: ["id", "name"],
        detail: [{ label: "Info", rows: [["name"]] }],
        create: ["name"],
      },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const rootRoute = createRootRoute();

    const routes = createRoutes(app, rootRoute);
    const routePaths = routes.map((r) => r.options.path);

    expect(routePaths).toContain("/employee");
    expect(routePaths).toContain("/employee/$id");
    expect(routePaths).toContain("/employee/new");
  });

  it("returns an empty array when no models have layouts", () => {
    const model = defineModel(employeeTable, {});
    const app = defineApp({ models: [model], auth: mockAuth });
    const rootRoute = createRootRoute();

    expect(createRoutes(app, rootRoute)).toHaveLength(0);
  });

  it("routes can be added to the root route to form a valid route tree", () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
    });
    const app = defineApp({ models: [model], auth: mockAuth });
    const rootRoute = createRootRoute();

    const routes = createRoutes(app, rootRoute);
    // addChildren should not throw — the route tree is structurally valid
    expect(() => rootRoute.addChildren(routes)).not.toThrow();
  });
});
