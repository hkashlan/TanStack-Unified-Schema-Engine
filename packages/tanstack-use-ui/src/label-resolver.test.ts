import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { defineModel } from "../../tanstack-use-core/src/define-model.js";
import { resolveLabel } from "./label-resolver.js";

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

// ---------------------------------------------------------------------------
// Fallback behaviour
// ---------------------------------------------------------------------------

describe("resolveLabel() — fallback to field key name", () => {
  it("returns the field key name when label is absent on the field config", () => {
    const model = defineModel(usersTable, { fields: { name: {} } });
    expect(resolveLabel("name", model)).toBe("name");
  });

  it("returns the field key name when the field has no entry in fields at all", () => {
    const model = defineModel(usersTable, {});
    expect(resolveLabel("email", model)).toBe("email");
  });

  it("returns the field key name when fields config is absent entirely", () => {
    const model = defineModel(usersTable, {});
    expect(resolveLabel("name", model)).toBe("name");
  });
});

// ---------------------------------------------------------------------------
// Callable label — () => string
// ---------------------------------------------------------------------------

describe("resolveLabel() — callable label", () => {
  it("calls the label function and returns its result", () => {
    const labelFn = vi.fn().mockReturnValue("Full Name");
    const model = defineModel(usersTable, { fields: { name: { label: labelFn } } });

    const result = resolveLabel("name", model);

    expect(labelFn).toHaveBeenCalledOnce();
    expect(result).toBe("Full Name");
  });

  it("calls the label function with no arguments (Paraglide convention)", () => {
    const labelFn = vi.fn().mockReturnValue("Nome");
    const model = defineModel(usersTable, { fields: { name: { label: labelFn } } });

    resolveLabel("name", model);

    expect(labelFn).toHaveBeenCalledWith();
  });

  it("re-evaluates the function on each call (reactive locale switching)", () => {
    let locale = "en";
    const labelFn = () => (locale === "en" ? "Full Name" : "Nom complet");
    const model = defineModel(usersTable, { fields: { name: { label: labelFn } } });

    expect(resolveLabel("name", model)).toBe("Full Name");
    locale = "fr";
    expect(resolveLabel("name", model)).toBe("Nom complet");
  });

  it("works with a Paraglide-style imported message function reference", () => {
    // Simulates: import { employeeName } from "./paraglide/messages.js"
    // defineModel(..., { fields: { name: { label: employeeName } } })
    const employeeName = () => "Employee Name";
    const model = defineModel(usersTable, { fields: { name: { label: employeeName } } });

    expect(resolveLabel("name", model)).toBe("Employee Name");
  });
});

// ---------------------------------------------------------------------------
// Mixed model
// ---------------------------------------------------------------------------

describe("resolveLabel() — mixed model", () => {
  it("resolves label function for one field and falls back for another", () => {
    const model = defineModel(usersTable, {
      fields: {
        name: { label: () => "Full Name" },
        // email has no label
      },
    });

    expect(resolveLabel("name", model)).toBe("Full Name");
    expect(resolveLabel("email", model)).toBe("email");
  });

  it("resolves different label functions independently", () => {
    const model = defineModel(usersTable, {
      fields: {
        name: { label: () => "Full Name" },
        email: { label: () => "Email Address" },
      },
    });

    expect(resolveLabel("name", model)).toBe("Full Name");
    expect(resolveLabel("email", model)).toBe("Email Address");
  });
});
