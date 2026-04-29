// Feature: tanstack-use, Property 6: Page existence matches layout presence
//
// For any model, a list/detail/create page is generated if and only if the
// corresponding ui.layout section is defined (non-absent).
// Validates: Requirements 1.5, 1.6, 1.7, 1.8

import { pgTable, serial, text } from "drizzle-orm/pg-core";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defineApp } from "../../tanstack-use-core/src/define-app.js";
import { defineModel } from "../../tanstack-use-core/src/define-model.js";
import { buildRouteDescriptors } from "./create-routes.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseTable = pgTable("item", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const mockAuth = {
  api: { getActiveMemberGroups: async () => [] },
};

// ---------------------------------------------------------------------------
// Arbitrary: optional layout sections
//
// Each section is independently present or absent. When present, we use a
// minimal valid value so the model definition is always well-formed.
// ---------------------------------------------------------------------------

type FieldKey = "id" | "name";

const arbLayoutDef = fc.record(
  {
    list: fc.option(fc.constant<FieldKey[]>(["id", "name"]), { nil: undefined }),
    detail: fc.option(
      fc.constant([{ label: "Info", rows: [["name"]] as FieldKey[][] }]),
      { nil: undefined },
    ),
    create: fc.option(fc.constant<FieldKey[]>(["name"]), { nil: undefined }),
  },
  { requiredKeys: [] },
);

// ---------------------------------------------------------------------------
// Property 6
// ---------------------------------------------------------------------------

describe("Property 6: Page existence matches layout presence", () => {
  it("generates a list route if and only if ui.layout.list is defined", () => {
    fc.assert(
      fc.property(arbLayoutDef, (layout) => {
        const model = defineModel(baseTable, { layout });
        const app = defineApp({ models: [model], auth: mockAuth });
        const descriptors = buildRouteDescriptors(app);

        const hasListRoute = descriptors.some((d) => d.type === "list");
        const listDefined = layout.list !== undefined;

        expect(hasListRoute).toBe(listDefined);
      }),
    );
  });

  it("generates a detail route if and only if ui.layout.detail is defined", () => {
    fc.assert(
      fc.property(arbLayoutDef, (layout) => {
        const model = defineModel(baseTable, { layout });
        const app = defineApp({ models: [model], auth: mockAuth });
        const descriptors = buildRouteDescriptors(app);

        const hasDetailRoute = descriptors.some((d) => d.type === "detail");
        const detailDefined = layout.detail !== undefined;

        expect(hasDetailRoute).toBe(detailDefined);
      }),
    );
  });

  it("generates a create route if and only if ui.layout.create is defined", () => {
    fc.assert(
      fc.property(arbLayoutDef, (layout) => {
        const model = defineModel(baseTable, { layout });
        const app = defineApp({ models: [model], auth: mockAuth });
        const descriptors = buildRouteDescriptors(app);

        const hasCreateRoute = descriptors.some((d) => d.type === "create");
        const createDefined = layout.create !== undefined;

        expect(hasCreateRoute).toBe(createDefined);
      }),
    );
  });

  it("total route count equals the number of defined layout sections", () => {
    fc.assert(
      fc.property(arbLayoutDef, (layout) => {
        const model = defineModel(baseTable, { layout });
        const app = defineApp({ models: [model], auth: mockAuth });
        const descriptors = buildRouteDescriptors(app);

        const expectedCount =
          (layout.list !== undefined ? 1 : 0) +
          (layout.detail !== undefined ? 1 : 0) +
          (layout.create !== undefined ? 1 : 0);

        expect(descriptors).toHaveLength(expectedCount);
      }),
    );
  });

  it("no extra or missing routes — route types match exactly the defined sections", () => {
    fc.assert(
      fc.property(arbLayoutDef, (layout) => {
        const model = defineModel(baseTable, { layout });
        const app = defineApp({ models: [model], auth: mockAuth });
        const descriptors = buildRouteDescriptors(app);

        const routeTypes = new Set(descriptors.map((d) => d.type));

        expect(routeTypes.has("list")).toBe(layout.list !== undefined);
        expect(routeTypes.has("detail")).toBe(layout.detail !== undefined);
        expect(routeTypes.has("create")).toBe(layout.create !== undefined);
      }),
    );
  });
});
