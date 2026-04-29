/**
 * Unit tests for DetailPage component.
 *
 * Requirements: 7.5, 7.6, 10.7
 *
 * Tests:
 *  - Tabbed interface renders one tab per `layout.detail` entry
 *  - Rows render fields side by side
 *  - `<FieldDisplay>` calls `format` with the full record
 *  - `<FieldDisplay>` calls `compute` for computed fields
 *  - Loading and error states are rendered correctly
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineModel } from "../../../tanstack-use-core/src/define-model.js";
import { DetailPage, FieldDisplay } from "./DetailPage.js";

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
 * Wraps a component in QueryClientProvider and sets up the get mock.
 */
function renderWithQuery(
  ui: React.ReactElement,
  record: Record<string, unknown> = {},
  getOk = true,
) {
  if (getOk) {
    mockServerFns.get.mockResolvedValue(record);
  } else {
    mockServerFns.get.mockRejectedValue(new Error("Server error"));
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );

  return { ...result, getMock: mockServerFns.get };
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Tabbed interface renders one tab per layout.detail entry
// ---------------------------------------------------------------------------

describe("DetailPage — tabs", () => {
  it("renders one tab button per entry in layout.detail", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [
          { label: "General", rows: [["id", "name"]] },
          { label: "Work Info", rows: [["department"]] },
        ],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {
      id: 1,
      name: "Alice",
      department: "Engineering",
    });

    await waitFor(() => {
      expect(screen.getByTestId("detail-tab-0")).toBeDefined();
      expect(screen.getByTestId("detail-tab-1")).toBeDefined();
    });

    expect(screen.getByText("General")).toBeDefined();
    expect(screen.getByText("Work Info")).toBeDefined();
  });

  it("renders the first tab as active by default", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [
          { label: "Tab A", rows: [["id"]] },
          { label: "Tab B", rows: [["name"]] },
        ],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {
      id: 1,
      name: "Alice",
      department: "Engineering",
    });

    await waitFor(() => {
      const tab0 = screen.getByTestId("detail-tab-0");
      expect(tab0.getAttribute("aria-selected")).toBe("true");
    });

    const tab1 = screen.getByTestId("detail-tab-1");
    expect(tab1.getAttribute("aria-selected")).toBe("false");
  });

  it("switches to the clicked tab", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [
          { label: "Tab A", rows: [["id"]] },
          { label: "Tab B", rows: [["name"]] },
        ],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {
      id: 1,
      name: "Alice",
      department: "Engineering",
    });

    await waitFor(() => {
      expect(screen.getByTestId("detail-tab-0")).toBeDefined();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("detail-tab-1"));

    expect(
      screen.getByTestId("detail-tab-1").getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByTestId("detail-tab-0").getAttribute("aria-selected"),
    ).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// 2. Rows render fields side by side
// ---------------------------------------------------------------------------

describe("DetailPage — rows render fields horizontally", () => {
  it("renders all fields in a row within the same row container", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id", "name", "department"]] }],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {
      id: 1,
      name: "Bob",
      department: "HR",
    });

    await waitFor(() => {
      expect(screen.getByTestId("detail-row-0-0")).toBeDefined();
    });

    // All three fields should be inside the same row container
    const row = screen.getByTestId("detail-row-0-0");
    expect(row.querySelector("[data-testid='field-display-id']")).toBeDefined();
    expect(
      row.querySelector("[data-testid='field-display-name']"),
    ).toBeDefined();
    expect(
      row.querySelector("[data-testid='field-display-department']"),
    ).toBeDefined();
  });

  it("renders multiple rows in the correct order", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [
          {
            label: "Info",
            rows: [["id"], ["name", "department"]],
          },
        ],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {
      id: 1,
      name: "Carol",
      department: "Design",
    });

    await waitFor(() => {
      expect(screen.getByTestId("detail-row-0-0")).toBeDefined();
      expect(screen.getByTestId("detail-row-0-1")).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. FieldDisplay calls format with the full record
// ---------------------------------------------------------------------------

describe("FieldDisplay — format receives full record", () => {
  it("calls format with the full record object, not just the field value", async () => {
    const formatFn = vi.fn(
      (record: { id: number; name: string; department: string }) =>
        `${record.name} (${record.department})`,
    );

    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["name"]] }],
      },
      fields: {
        name: {
          format: formatFn as unknown as (
            record: Record<string, unknown>,
          ) => string,
        },
      },
    });

    const record = { id: 1, name: "Alice", department: "Engineering" };
    renderWithQuery(<DetailPage model={model} id={1} />, record);

    await waitFor(() => {
      expect(formatFn).toHaveBeenCalledWith(record);
    });

    expect(screen.getByText("Alice (Engineering)")).toBeDefined();
  });

  it("renders raw field value when format is absent", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["name"]] }],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {
      id: 1,
      name: "Bob",
      department: "HR",
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-value-name")).toBeDefined();
    });

    expect(screen.getByTestId("field-value-name").textContent).toBe("Bob");
  });
});

// ---------------------------------------------------------------------------
// 4. FieldDisplay renders computed fields
// ---------------------------------------------------------------------------

describe("FieldDisplay — computed fields", () => {
  it("renders computed field value via compute(record)", async () => {
    const computeFn = vi.fn(
      (record: { id: number; name: string; department: string }) =>
        `${record.name} — ${record.department}`,
    );

    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["fullInfo"]] }],
      },
      computedFields: {
        fullInfo: {
          dependsOn: ["name", "department"],
          compute: computeFn as unknown as (
            record: Record<string, unknown>,
          ) => unknown,
        },
      },
    });

    const record = { id: 1, name: "Carol", department: "Design" };
    renderWithQuery(<DetailPage model={model} id={1} />, record);

    await waitFor(() => {
      expect(computeFn).toHaveBeenCalledWith(record);
    });

    expect(screen.getByText("Carol — Design")).toBeDefined();
  });

  it("uses format over compute when both are defined on a computed field", async () => {
    const computeFn = vi.fn(() => "raw");
    const formatFn = vi.fn(
      (record: { id: number; name: string; department: string }) =>
        `formatted:${record.name}`,
    );

    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["display"]] }],
      },
      computedFields: {
        display: {
          dependsOn: ["name"],
          compute: computeFn as unknown as (
            record: Record<string, unknown>,
          ) => unknown,
          format: formatFn as unknown as (
            record: Record<string, unknown>,
          ) => string,
        },
      },
    });

    const record = { id: 1, name: "Dave", department: "Ops" };
    renderWithQuery(<DetailPage model={model} id={1} />, record);

    await waitFor(() => {
      expect(formatFn).toHaveBeenCalledWith(record);
    });

    expect(screen.getByText("formatted:Dave")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 5. FieldDisplay resolves labels
// ---------------------------------------------------------------------------

describe("FieldDisplay — label resolution", () => {
  it("uses the label function when defined", () => {
    const model = defineModel(employeeTable, {
      layout: { detail: [{ label: "Info", rows: [["name"]] }] },
      fields: {
        name: { label: () => "Full Name" },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FieldDisplay
          fieldName="name"
          record={{ id: 1, name: "Alice", department: "Engineering" }}
          model={model}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("field-label-name").textContent).toBe(
      "Full Name:",
    );
  });

  it("falls back to the field key name when label is absent", () => {
    const model = defineModel(employeeTable, {
      layout: { detail: [{ label: "Info", rows: [["name"]] }] },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FieldDisplay
          fieldName="name"
          record={{ id: 1, name: "Alice", department: "Engineering" }}
          model={model}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("field-label-name").textContent).toBe("name:");
  });
});

// ---------------------------------------------------------------------------
// 6. Loading and error states
// ---------------------------------------------------------------------------

describe("DetailPage — loading and error states", () => {
  it("renders a loading indicator while fetching", () => {
    // Never resolves — simulates pending state
    mockServerFns.get.mockReturnValue(new Promise(() => undefined));

    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id"]] }],
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DetailPage model={model} id={1} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("detail-loading")).toBeDefined();
  });

  it("renders an error message when the fetch fails", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id"]] }],
      },
    });

    renderWithQuery(<DetailPage model={model} id={1} />, {}, false);

    await waitFor(() => {
      expect(screen.getByTestId("detail-error")).toBeDefined();
    });
  });

  it("calls get with the correct tableName and id", async () => {
    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id"]] }],
      },
    });

    const { getMock } = renderWithQuery(<DetailPage model={model} id={42} />, {
      id: 42,
      name: "Test",
      department: "QA",
    });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith({
        data: { tableName: "employee", id: 42 },
      });
    });
  });
});
