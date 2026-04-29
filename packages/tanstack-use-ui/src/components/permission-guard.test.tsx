/**
 * Unit tests for permission enforcement in page components.
 *
 * Requirements: 5.4, 10.3
 *
 * Tests:
 *  - ListPage redirects to /unauthorized when can() returns false
 *  - ListPage renders normally when can() returns true
 *  - DetailPage redirects to /unauthorized when can() returns false
 *  - DetailPage renders normally when can() returns true
 *  - CreatePage redirects to /unauthorized when can() returns false
 *  - CreatePage renders normally when can() returns true
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { defineApp } from "../../../tanstack-use-core/src/define-app.js";
import { defineModel } from "../../../tanstack-use-core/src/define-model.js";
import { ListPage } from "./ListPage.js";
import { DetailPage } from "./DetailPage.js";
import { CreatePage } from "./CreatePage.js";

// ---------------------------------------------------------------------------
// Mock useServerFunctions
// ---------------------------------------------------------------------------

vi.mock("../server-functions-context.js", () => ({
  useServerFunctions: () => mockServerFns,
}));

// ---------------------------------------------------------------------------
// Mock can() from @tanstack-use/permissions
// ---------------------------------------------------------------------------

vi.mock("@tanstack-use/permissions", () => ({
  can: mockCan,
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
  },
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
// Mocks — defined at module scope so vi.mock closures can reference them
// ---------------------------------------------------------------------------

const mockServerFns = {
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue({ id: 1, name: "Alice", department: "Eng" }),
  create: vi
    .fn()
    .mockResolvedValue({ id: 1, name: "Alice", department: "Eng" }),
  update: vi.fn(),
  remove: vi.fn(),
};

// can() mock — controlled per test
function mockCan(
  _session: unknown,
  _target: string,
  _app: unknown,
): Promise<boolean> {
  return mockCanImpl(_session, _target, _app);
}
let mockCanImpl: (
  _session: unknown,
  _target: string,
  _app: unknown,
) => Promise<boolean> = async () => true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp(model: ReturnType<typeof defineModel>) {
  return defineApp({
    models: [model],
    auth: {
      api: {
        getActiveMemberGroups: async () => [],
        getSession: async () => ({ user: { id: "u1" } }),
      },
    },
  });
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Reset can() to allow by default
  mockCanImpl = async () => true;
});

// ---------------------------------------------------------------------------
// ListPage — permission enforcement
// ---------------------------------------------------------------------------

describe("ListPage — permission enforcement", () => {
  it("redirects to /unauthorized when can() returns false for read", async () => {
    mockCanImpl = async () => false;

    const onUnauthorized = vi.fn();
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
      permissions: { read: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <ListPage
        model={model}
        session={session}
        app={app}
        searchParams={{}}
        onNavigate={() => undefined}
        onUnauthorized={onUnauthorized}
      />,
    );

    await waitFor(() => {
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    // The unauthorized placeholder should be rendered
    expect(screen.getByTestId("list-page-unauthorized")).toBeDefined();
  });

  it("renders the list page normally when can() returns true for read", async () => {
    mockCanImpl = async () => true;

    const onUnauthorized = vi.fn();
    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
      permissions: { read: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <ListPage
        model={model}
        session={session}
        app={app}
        searchParams={{}}
        onNavigate={() => undefined}
        onUnauthorized={onUnauthorized}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("list-page")).toBeDefined();
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("skips permission check and renders normally when session is absent", async () => {
    // can() should never be called when session is absent
    mockCanImpl = async () => {
      throw new Error("can() should not be called without a session");
    };

    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
      permissions: { read: ["admin"] },
    });

    renderWithQuery(
      <ListPage model={model} searchParams={{}} onNavigate={() => undefined} />,
    );

    // Should render the list page without any permission check
    await waitFor(() => {
      expect(screen.getByTestId("list-page")).toBeDefined();
    });
  });

  it("calls can() with the correct target (ModelName.read)", async () => {
    const canSpy = vi.fn(async () => true);
    mockCanImpl = canSpy;

    const model = defineModel(employeeTable, {
      layout: { list: ["id", "name"] },
      permissions: { read: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <ListPage
        model={model}
        session={session}
        app={app}
        searchParams={{}}
        onNavigate={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(canSpy).toHaveBeenCalledWith(session, "employee.read", app);
    });
  });
});

// ---------------------------------------------------------------------------
// DetailPage — permission enforcement
// ---------------------------------------------------------------------------

describe("DetailPage — permission enforcement", () => {
  it("redirects to /unauthorized when can() returns false for read", async () => {
    mockCanImpl = async () => false;

    const onUnauthorized = vi.fn();
    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id", "name"]] }],
      },
      permissions: { read: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <DetailPage
        model={model}
        id={1}
        session={session}
        app={app}
        onUnauthorized={onUnauthorized}
      />,
    );

    await waitFor(() => {
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("detail-page-unauthorized")).toBeDefined();
  });

  it("renders the detail page normally when can() returns true for read", async () => {
    mockCanImpl = async () => true;

    const onUnauthorized = vi.fn();
    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id", "name"]] }],
      },
      permissions: { read: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <DetailPage
        model={model}
        id={1}
        session={session}
        app={app}
        onUnauthorized={onUnauthorized}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("detail-page")).toBeDefined();
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("skips permission check and renders normally when session is absent", async () => {
    mockCanImpl = async () => {
      throw new Error("can() should not be called without a session");
    };

    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id", "name"]] }],
      },
      permissions: { read: ["admin"] },
    });

    renderWithQuery(<DetailPage model={model} id={1} />);

    await waitFor(() => {
      expect(screen.getByTestId("detail-page")).toBeDefined();
    });
  });

  it("calls can() with the correct target (ModelName.read)", async () => {
    const canSpy = vi.fn(async () => true);
    mockCanImpl = canSpy;

    const model = defineModel(employeeTable, {
      layout: {
        detail: [{ label: "Info", rows: [["id", "name"]] }],
      },
      permissions: { read: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <DetailPage model={model} id={1} session={session} app={app} />,
    );

    await waitFor(() => {
      expect(canSpy).toHaveBeenCalledWith(session, "employee.read", app);
    });
  });
});

// ---------------------------------------------------------------------------
// CreatePage — permission enforcement
// ---------------------------------------------------------------------------

describe("CreatePage — permission enforcement", () => {
  it("redirects to /unauthorized when can() returns false for create", async () => {
    mockCanImpl = async () => false;

    const onUnauthorized = vi.fn();
    const model = defineModel(employeeTable, {
      layout: { create: ["name", "department"] },
      permissions: { create: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <CreatePage
        model={model}
        session={session}
        app={app}
        onUnauthorized={onUnauthorized}
      />,
    );

    await waitFor(() => {
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("create-page-unauthorized")).toBeDefined();
  });

  it("renders the create page normally when can() returns true for create", async () => {
    mockCanImpl = async () => true;

    const onUnauthorized = vi.fn();
    const model = defineModel(employeeTable, {
      layout: { create: ["name", "department"] },
      permissions: { create: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(
      <CreatePage
        model={model}
        session={session}
        app={app}
        onUnauthorized={onUnauthorized}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("create-page")).toBeDefined();
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("skips permission check and renders normally when session is absent", async () => {
    mockCanImpl = async () => {
      throw new Error("can() should not be called without a session");
    };

    const model = defineModel(employeeTable, {
      layout: { create: ["name", "department"] },
      permissions: { create: ["admin"] },
    });

    renderWithQuery(<CreatePage model={model} />);

    await waitFor(() => {
      expect(screen.getByTestId("create-page")).toBeDefined();
    });
  });

  it("calls can() with the correct target (ModelName.create)", async () => {
    const canSpy = vi.fn(async () => true);
    mockCanImpl = canSpy;

    const model = defineModel(employeeTable, {
      layout: { create: ["name", "department"] },
      permissions: { create: ["admin"] },
    });
    const app = makeApp(model);
    const session = { user: { id: "u1" } };

    renderWithQuery(<CreatePage model={model} session={session} app={app} />);

    await waitFor(() => {
      expect(canSpy).toHaveBeenCalledWith(session, "employee.create", app);
    });
  });
});
