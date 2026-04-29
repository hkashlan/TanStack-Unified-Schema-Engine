/**
 * Unit tests for ListPage component.
 *
 * Requirements: 7.4, 3.3, 11.7, 10.7
 *
 * Tests:
 *  - Column headers match resolveLabel output for each field in ui.layout.list
 *  - format(record) is called with the full record (not just the field value)
 *  - Computed field values are rendered via compute(record)
 *  - Search input is rendered and wired to the debouncer
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineModel } from "../../../tanstack-use-core/src/define-model.js";
import { ListPage } from "./ListPage.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const employeeTable = pgTable("employee", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a component in QueryClientProvider and stubs fetch.
 * Passes `searchParams={{}}` and a no-op `onNavigate` to avoid needing a
 * real TanStack Router context.
 */
function renderWithQuery(
  ui: React.ReactElement,
  records: Record<string, unknown>[] = [],
) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => records,
  });
  vi.stubGlobal("fetch", fetchMock);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );

  return { ...result, fetchMock };
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Column headers match resolveLabel output
// ---------------------------------------------------------------------------

describe("ListPage — column headers", () => {
  it("renders a column header for each field in ui.layout.list using resolveLabel", async () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name", "department"] },
      fields: {
        id: { label: () => "ID" },
        name: { label: () => "Full Name" },
        department: { label: () => "Dept" },
      },
    });

    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      [],
    );

    // Headers are rendered synchronously from column definitions — no async needed
    expect(screen.getByText("ID")).toBeDefined();
    expect(screen.getByText("Full Name")).toBeDefined();
    expect(screen.getByText("Dept")).toBeDefined();
  });

  it("falls back to the field key name when label is absent", () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
    });

    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      [],
    );

    expect(screen.getByText("id")).toBeDefined();
    expect(screen.getByText("name")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. format(record) receives the full record
// ---------------------------------------------------------------------------

describe("ListPage — format receives full record", () => {
  it("calls format with the full record object, not just the field value", async () => {
    const formatFn = vi.fn(
      (record: { id: number; name: string; department: string }) =>
        `${record.name} (${record.department})`,
    );

    const model = defineModel(employeeTable, {
      layout: { list: ["name"] },
      fields: {
        name: {
          format: formatFn as unknown as (
            record: Record<string, unknown>,
          ) => string,
        },
      },
    });

    const records = [{ id: 1, name: "Alice", department: "Engineering" }];
    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      records,
    );

    // Wait for the query to resolve and the component to re-render with data
    await waitFor(() => {
      expect(formatFn).toHaveBeenCalledWith(records[0]);
    });

    // The rendered cell should show the formatted value
    expect(screen.getByText("Alice (Engineering)")).toBeDefined();
  });

  it("renders raw field value when format is absent", async () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["name"] },
    });

    const records = [{ id: 1, name: "Bob", department: "HR" }];
    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      records,
    );

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Computed field values rendered via compute(record)
// ---------------------------------------------------------------------------

describe("ListPage — computed fields", () => {
  it("renders computed field value via compute(record)", async () => {
    const computeFn = vi.fn(
      (record: { id: number; name: string; department: string }) =>
        `${record.name} — ${record.department}`,
    );

    const model = defineModel(employeeTable, {
      layout: { list: ["fullInfo"] },
      computedFields: {
        fullInfo: {
          dependsOn: ["name", "department"],
          compute: computeFn as unknown as (
            record: Record<string, unknown>,
          ) => unknown,
        },
      },
    });

    const records = [{ id: 1, name: "Carol", department: "Design" }];
    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      records,
    );

    await waitFor(() => {
      // compute was called with the full record
      expect(computeFn).toHaveBeenCalledWith(records[0]);
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
      layout: { list: ["display"] },
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

    const records = [{ id: 1, name: "Dave", department: "Ops" }];
    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      records,
    );

    await waitFor(() => {
      expect(formatFn).toHaveBeenCalledWith(records[0]);
    });

    expect(screen.getByText("formatted:Dave")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Search input is rendered and wired to the debouncer
// ---------------------------------------------------------------------------

describe("ListPage — search input", () => {
  it("renders a search input", () => {
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
    });

    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      [],
    );

    expect(screen.getByTestId("list-search")).toBeDefined();
  });

  it("does not fire a new query immediately on each keystroke (debounce)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"], listOptions: { searchDebounceMs: 300 } },
    });

    const { fetchMock } = renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      [],
    );

    // Wait for the initial query to fire
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const searchInput = screen.getByTestId("list-search");
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime.bind(vi),
    });

    // Type quickly — each keystroke should NOT immediately fire a new query
    await user.type(searchInput, "a");
    await user.type(searchInput, "b");
    await user.type(searchInput, "c");

    // Still only the initial query should have fired (debounce hasn't settled)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the debounce window
    vi.advanceTimersByTime(400);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The second call should include the search term
    const secondCallUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(secondCallUrl).toContain("search=abc");

    vi.useRealTimers();
  });

  it("fires a new query after the debounce window expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"], listOptions: { searchDebounceMs: 200 } },
    });

    const { fetchMock } = renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
      [],
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const searchInput = screen.getByTestId("list-search");
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime.bind(vi),
    });

    await user.type(searchInput, "hello");
    vi.advanceTimersByTime(300);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    vi.useRealTimers();
  });
});
