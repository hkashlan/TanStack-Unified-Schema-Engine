/**
 * Property-based tests for CreatePage — Property 7.
 *
 * Feature: tanstack-use
 *
 * Property 7: onSubmit transformation is applied before submission
 *   For any record and any transform function, the value passed to the create
 *   server function equals onSubmit(record), not the original form values.
 *   Validates: Requirements 7.7, 10.7
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import * as fc from "fast-check";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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
 * Returns the createMock so callers can inspect what was passed.
 */
function renderWithQuery(ui: React.ReactElement) {
  mockServerFns.create.mockResolvedValue({});

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
// Property 7: onSubmit transformation is applied before submission
// ---------------------------------------------------------------------------

describe("Property 7: onSubmit transformation is applied before submission", () => {
  /**
   * **Validates: Requirements 7.7, 10.7**
   *
   * Core property (sync transforms):
   * For any record { name, department } and any sync transform function,
   * the value passed to create equals transformFn(record), not the original values.
   */
  it("create is called with transformFn(record) for sync transforms", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }),
          department: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        fc.func(
          fc.record({
            name: fc.string({ minLength: 0, maxLength: 20 }),
            department: fc.string({ minLength: 0, maxLength: 20 }),
          }),
        ),
        async (record, transformFn) => {
          cleanup();
          vi.clearAllMocks();

          const expected = transformFn(record);

          const model = defineModel(employeeTable, {
            layout: { create: ["name", "department"] },
            client: {
              onSubmit: transformFn as unknown as (r: {
                id: number;
                name: string;
                department: string;
              }) => { id: number; name: string; department: string },
            },
          });

          const { createMock, getByTestId } = renderWithQuery(
            <CreatePage model={model} />,
          );

          // Use fireEvent.change to set values directly — avoids userEvent's
          // special-character parsing (e.g. `[` and `{` are keyboard descriptors).
          fireEvent.change(getByTestId("field-input-name"), {
            target: { value: record.name },
          });
          fireEvent.change(getByTestId("field-input-department"), {
            target: { value: record.department },
          });
          fireEvent.submit(getByTestId("create-form"));

          await waitFor(() => {
            expect(createMock).toHaveBeenCalledTimes(1);
          });

          const callArg = createMock.mock.calls[0]?.[0] as {
            data: { tableName: string; record: Record<string, unknown> };
          };

          expect(callArg.data.record).toMatchObject(expected);
        },
      ),
      { numRuns: 10 },
    );
  });

  /**
   * **Validates: Requirements 7.7, 10.7**
   *
   * Core property (async transforms):
   * Same as above but with async transform functions (returning a Promise).
   */
  it("create is called with await transformFn(record) for async transforms", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }),
          department: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        fc.func(
          fc.record({
            name: fc.string({ minLength: 0, maxLength: 20 }),
            department: fc.string({ minLength: 0, maxLength: 20 }),
          }),
        ),
        async (record, syncTransformFn) => {
          cleanup();
          vi.clearAllMocks();

          // Wrap the sync transform in an async function
          const asyncTransformFn = async (r: {
            name: string;
            department: string;
          }) => Promise.resolve(syncTransformFn(r));

          const expected = syncTransformFn(record);

          const model = defineModel(employeeTable, {
            layout: { create: ["name", "department"] },
            client: {
              onSubmit: asyncTransformFn as unknown as (r: {
                id: number;
                name: string;
                department: string;
              }) => Promise<{ id: number; name: string; department: string }>,
            },
          });

          const { createMock, getByTestId } = renderWithQuery(
            <CreatePage model={model} />,
          );

          fireEvent.change(getByTestId("field-input-name"), {
            target: { value: record.name },
          });
          fireEvent.change(getByTestId("field-input-department"), {
            target: { value: record.department },
          });
          fireEvent.submit(getByTestId("create-form"));

          await waitFor(() => {
            expect(createMock).toHaveBeenCalledTimes(1);
          });

          const callArg = createMock.mock.calls[0]?.[0] as {
            data: { tableName: string; record: Record<string, unknown> };
          };

          expect(callArg.data.record).toMatchObject(expected);
        },
      ),
      { numRuns: 10 },
    );
  });

  /**
   * **Validates: Requirements 7.7, 10.7**
   *
   * Identity property:
   * When onSubmit is the identity function, the value passed to create equals
   * the original form values.
   */
  it("create is called with original form values when onSubmit is the identity function", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }),
          department: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (record) => {
          cleanup();
          vi.clearAllMocks();

          const identityFn = (r: { name: string; department: string }) => r;

          const model = defineModel(employeeTable, {
            layout: { create: ["name", "department"] },
            client: {
              onSubmit: identityFn as unknown as (r: {
                id: number;
                name: string;
                department: string;
              }) => { id: number; name: string; department: string },
            },
          });

          const { createMock, getByTestId } = renderWithQuery(
            <CreatePage model={model} />,
          );

          fireEvent.change(getByTestId("field-input-name"), {
            target: { value: record.name },
          });
          fireEvent.change(getByTestId("field-input-department"), {
            target: { value: record.department },
          });
          fireEvent.submit(getByTestId("create-form"));

          await waitFor(() => {
            expect(createMock).toHaveBeenCalledTimes(1);
          });

          const callArg = createMock.mock.calls[0]?.[0] as {
            data: { tableName: string; record: Record<string, unknown> };
          };

          expect(callArg.data.record).toMatchObject({
            name: record.name,
            department: record.department,
          });
        },
      ),
      { numRuns: 10 },
    );
  });

  /**
   * **Validates: Requirements 7.7, 10.7**
   *
   * No onSubmit property:
   * When no onSubmit is defined, the value passed to create equals the raw form values.
   */
  it("create is called with raw form values when no onSubmit is defined", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }),
          department: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (record) => {
          cleanup();
          vi.clearAllMocks();

          const model = defineModel(employeeTable, {
            layout: { create: ["name", "department"] },
          });

          const { createMock, getByTestId } = renderWithQuery(
            <CreatePage model={model} />,
          );

          fireEvent.change(getByTestId("field-input-name"), {
            target: { value: record.name },
          });
          fireEvent.change(getByTestId("field-input-department"), {
            target: { value: record.department },
          });
          fireEvent.submit(getByTestId("create-form"));

          await waitFor(() => {
            expect(createMock).toHaveBeenCalledTimes(1);
          });

          const callArg = createMock.mock.calls[0]?.[0] as {
            data: { tableName: string; record: Record<string, unknown> };
          };

          expect(callArg.data.record).toMatchObject({
            name: record.name,
            department: record.department,
          });
        },
      ),
      { numRuns: 10 },
    );
  });
});
