/**
 * Unit tests for CreatePage component.
 *
 * Requirements: 3.2, 7.7, 10.2, 10.7, 12.3, 12.4
 *
 * Tests:
 *  1. Computed fields are excluded from the form field list
 *  2. `onSubmit` hook is called with the full record before submission
 *  3. The value submitted to the API is the return value of `onSubmit`, not the original record
 *  4. A field with a failing `validate` function shows an error message
 *  5. The submit button is disabled when a field has a validation error
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineModel } from "../../../tanstack-use-core/src/define-model.js";
import { CreatePage } from "./CreatePage.js";

// ---------------------------------------------------------------------------
// Mock useServerFunctions
// ---------------------------------------------------------------------------

vi.mock("../server-functions-context.js", () => ({
  useServerFunctions: () => mockServerFns,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
});

// ---------------------------------------------------------------------------
// Mock server functions
// ---------------------------------------------------------------------------

const mockServerFns = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a component in QueryClientProvider and sets up the create mock.
 */
function renderWithQuery(
  ui: React.ReactElement,
  responseRecord: Record<string, unknown> = {},
  createOk = true,
) {
  if (createOk) {
    mockServerFns.create.mockResolvedValue(responseRecord);
  } else {
    mockServerFns.create.mockRejectedValue(new Error("Server error"));
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );

  return { ...result, createMock: mockServerFns.create };
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Computed fields are excluded from the form field list (Requirement 3.2)
// ---------------------------------------------------------------------------

describe("CreatePage — computed fields excluded", () => {
  it("does not render an input for a computed field key listed in layout.create", () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "department", "fullInfo"],
      },
      computedFields: {
        fullInfo: {
          dependsOn: ["name", "department"],
          compute: (record) =>
            `${(record as { name: string }).name} — ${(record as { department: string }).department}`,
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    // Regular fields should be present
    expect(screen.getByTestId("field-input-name")).toBeDefined();
    expect(screen.getByTestId("field-input-department")).toBeDefined();

    // Computed field should NOT have an input
    expect(screen.queryByTestId("field-input-fullInfo")).toBeNull();
    expect(screen.queryByTestId("field-input-wrapper-fullInfo")).toBeNull();
  });

  it("renders only non-computed fields when all layout.create fields are listed", () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "computedA", "computedB"],
      },
      computedFields: {
        computedA: {
          dependsOn: ["name"],
          compute: (record) =>
            String((record as { name: string }).name).toUpperCase(),
        },
        computedB: {
          dependsOn: ["department"],
          compute: (record) =>
            String((record as { department: string }).department).toLowerCase(),
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    expect(screen.getByTestId("field-input-name")).toBeDefined();
    expect(screen.queryByTestId("field-input-computedA")).toBeNull();
    expect(screen.queryByTestId("field-input-computedB")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. onSubmit hook is called with the full record before submission (Req 7.7)
// ---------------------------------------------------------------------------

describe("CreatePage — onSubmit hook receives full record", () => {
  it("calls model.ui.client.onSubmit with the full form record before creating", async () => {
    const onSubmitHook = vi.fn((record: Record<string, unknown>) => record);

    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "department"],
      },
      client: {
        onSubmit: onSubmitHook as unknown as (record: {
          id: number;
          name: string;
          department: string;
        }) => { id: number; name: string; department: string },
      },
    });

    renderWithQuery(<CreatePage model={model} />, {
      id: 1,
      name: "Alice",
      department: "Engineering",
    });

    const user = userEvent.setup();

    await user.type(screen.getByTestId("field-input-name"), "Alice");
    await user.type(
      screen.getByTestId("field-input-department"),
      "Engineering",
    );

    await user.click(screen.getByTestId("create-submit"));

    await waitFor(() => {
      expect(onSubmitHook).toHaveBeenCalledTimes(1);
    });

    // The hook should have been called with the full record containing both fields
    const calledWith = onSubmitHook.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(calledWith).toMatchObject({
      name: "Alice",
      department: "Engineering",
    });
  });
});

// ---------------------------------------------------------------------------
// 3. The value submitted to the API is the return value of onSubmit (Req 7.7)
// ---------------------------------------------------------------------------

describe("CreatePage — API receives onSubmit return value", () => {
  it("calls create with the transformed record returned by onSubmit, not the original form values", async () => {
    const transformedRecord = {
      name: "ALICE",
      department: "ENGINEERING",
      extra: "added",
    };

    const onSubmitHook = vi.fn(() => transformedRecord);

    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "department"],
      },
      client: {
        onSubmit: onSubmitHook as unknown as (record: {
          id: number;
          name: string;
          department: string;
        }) => { id: number; name: string; department: string },
      },
    });

    const { createMock } = renderWithQuery(<CreatePage model={model} />, {
      id: 1,
      ...transformedRecord,
    });

    const user = userEvent.setup();

    await user.type(screen.getByTestId("field-input-name"), "alice");
    await user.type(
      screen.getByTestId("field-input-department"),
      "engineering",
    );

    await user.click(screen.getByTestId("create-submit"));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    // create should have been called with the transformed record
    const createCallArg = createMock.mock.calls[0]?.[0] as {
      data: { tableName: string; record: Record<string, unknown> };
    };
    expect(createCallArg.data.record).toMatchObject(transformedRecord);
    expect(createCallArg.data.record.name).toBe("ALICE");
    expect(createCallArg.data.record.department).toBe("ENGINEERING");
    expect(createCallArg.data.record.extra).toBe("added");
  });

  it("calls create with the original form values when no onSubmit hook is defined", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "department"],
      },
    });

    const { createMock } = renderWithQuery(<CreatePage model={model} />, {
      id: 1,
      name: "Bob",
      department: "HR",
    });

    const user = userEvent.setup();

    await user.type(screen.getByTestId("field-input-name"), "Bob");
    await user.type(screen.getByTestId("field-input-department"), "HR");

    await user.click(screen.getByTestId("create-submit"));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    const createCallArg = createMock.mock.calls[0]?.[0] as {
      data: { tableName: string; record: Record<string, unknown> };
    };
    expect(createCallArg.data.record).toMatchObject({
      name: "Bob",
      department: "HR",
    });
  });
});

// ---------------------------------------------------------------------------
// 4. A field with a failing validate function shows an error message (Req 12.3)
// ---------------------------------------------------------------------------

describe("CreatePage — validation error messages", () => {
  it("shows an error message below a field when validate returns an error string", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "department"],
      },
      fields: {
        name: {
          validate: (value) =>
            !value || String(value).trim() === ""
              ? "Name is required"
              : undefined,
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    const user = userEvent.setup();

    // Focus and blur the name field without entering a value to trigger validation
    const nameInput = screen.getByTestId("field-input-name");
    await user.click(nameInput);
    await user.tab(); // blur the field

    await waitFor(() => {
      expect(screen.getByTestId("field-error-name")).toBeDefined();
    });

    expect(screen.getByTestId("field-error-name").textContent).toContain(
      "Name is required",
    );
  });

  it("shows an error message when invalid value is typed into a field", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name"],
      },
      fields: {
        name: {
          validate: (value) =>
            String(value).length < 3
              ? "Name must be at least 3 characters"
              : undefined,
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    const user = userEvent.setup();

    // Type a value that is too short to trigger onChange validation
    await user.type(screen.getByTestId("field-input-name"), "ab");

    await waitFor(() => {
      expect(screen.getByTestId("field-error-name")).toBeDefined();
    });

    expect(screen.getByTestId("field-error-name").textContent).toContain(
      "Name must be at least 3 characters",
    );
  });

  it("clears the error message when the field value becomes valid", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name"],
      },
      fields: {
        name: {
          validate: (value) =>
            String(value).length < 3 ? "Too short" : undefined,
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    const user = userEvent.setup();

    // Type an invalid value first
    await user.type(screen.getByTestId("field-input-name"), "ab");

    await waitFor(() => {
      expect(screen.getByTestId("field-error-name")).toBeDefined();
    });

    // Now type more to make it valid
    await user.type(screen.getByTestId("field-input-name"), "c");

    await waitFor(() => {
      expect(screen.queryByTestId("field-error-name")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Submit button is disabled when a field has a validation error (Req 12.4)
// ---------------------------------------------------------------------------

describe("CreatePage — submit button disabled on validation error", () => {
  it("disables the submit button when a field has a validation error", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name"],
      },
      fields: {
        name: {
          validate: (value) =>
            !value || String(value).trim() === "" ? "Required" : undefined,
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    const user = userEvent.setup();

    // Type an invalid value to trigger onChange validation
    await user.type(screen.getByTestId("field-input-name"), "a");
    // Clear it to make it invalid again
    await user.clear(screen.getByTestId("field-input-name"));

    await waitFor(() => {
      expect(screen.getByTestId("field-error-name")).toBeDefined();
    });

    await waitFor(() => {
      const submitButton = screen.getByTestId("create-submit");
      expect(submitButton.hasAttribute("disabled")).toBe(true);
    });
  });

  it("re-enables the submit button when the validation error is resolved", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name"],
      },
      fields: {
        name: {
          validate: (value) =>
            String(value).length < 3 ? "Too short" : undefined,
        },
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    const user = userEvent.setup();

    // Type an invalid value
    await user.type(screen.getByTestId("field-input-name"), "ab");

    await waitFor(() => {
      expect(screen.getByTestId("field-error-name")).toBeDefined();
    });

    // Submit should be disabled
    await waitFor(() => {
      expect(screen.getByTestId("create-submit").hasAttribute("disabled")).toBe(
        true,
      );
    });

    // Fix the value
    await user.type(screen.getByTestId("field-input-name"), "c");

    await waitFor(() => {
      expect(screen.queryByTestId("field-error-name")).toBeNull();
    });

    // Submit should be enabled again
    expect(screen.getByTestId("create-submit").hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("submit button is enabled when no validation errors exist", () => {
    const model = defineModel(employeeTable, {
      layout: {
        create: ["name", "department"],
      },
    });

    renderWithQuery(<CreatePage model={model} />);

    // No validation errors — button should be enabled initially
    const submitButton = screen.getByTestId("create-submit");
    expect(submitButton.hasAttribute("disabled")).toBe(false);
  });
});
