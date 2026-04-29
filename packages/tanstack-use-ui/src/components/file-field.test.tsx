/**
 * Unit tests for file field rendering in FieldDisplay and FileFieldInput.
 *
 * Requirements: 6.6, 6.7
 *
 * Tests:
 *  1. FieldDisplay renders a file preview for file fields declared in UIConfig.fileFields
 *  2. FileFieldInput renders a file upload input for members with access
 *  3. FileFieldInput renders a read-only display for members without access
 *  4. FileFieldInput renders read-only when no app/session is provided
 *  5. FileFieldInput renders upload input when fileAccess is empty (open access)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { defineModel } from "../../../tanstack-use-core/src/define-model.js";
import { fileModel } from "../../../tanstack-use-files/src/file-model.js";
import { FieldDisplay } from "./DetailPage.js";
import { FileFieldInput } from "./CreatePage.js";

// ---------------------------------------------------------------------------
// Mock useServerFunctions (needed by DetailPage internals)
// ---------------------------------------------------------------------------

vi.mock("../server-functions-context.js", () => ({
  useServerFunctions: () => mockServerFns,
}));

const mockServerFns = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const storage = {
  store: vi.fn().mockResolvedValue("uploads/file.txt"),
  delete: vi.fn().mockResolvedValue(undefined),
};

// FileModelColumn objects — used in UIConfig.fileFields
const fm = fileModel({ storage, fileAccess: ["admin"] });
const openFm = fileModel({ storage }); // no fileAccess — open access

// Plain table — file field is declared via UIConfig.fileFields, not via column type
const documentTable = pgTable("document", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  attachment: text("attachment"),
});

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function makeApp(memberGroups: string[]) {
  return {
    _tag: "App" as const,
    models: new Map(),
    auth: {
      api: {
        getActiveMemberGroups: vi.fn().mockResolvedValue(memberGroups),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// 1. FieldDisplay renders a file preview for file fields (Requirement 6.6)
// ---------------------------------------------------------------------------

describe("FieldDisplay — file field preview", () => {
  it("renders a file preview element when the field is declared in fileFields", () => {
    const model = defineModel(documentTable, {
      fileFields: { attachment: fm },
      layout: {
        detail: [{ label: "Info", rows: [["attachment"]] }],
      },
    });

    renderWithQuery(
      <FieldDisplay
        fieldName="attachment"
        record={{ id: 1, title: "Report", attachment: "uploads/report.pdf" }}
        model={model}
      />,
    );

    expect(screen.getByTestId("file-preview-attachment")).toBeDefined();
  });

  it("renders a link for non-image file paths", () => {
    const model = defineModel(documentTable, {
      fileFields: { attachment: fm },
      layout: {
        detail: [{ label: "Info", rows: [["attachment"]] }],
      },
    });

    renderWithQuery(
      <FieldDisplay
        fieldName="attachment"
        record={{ id: 1, title: "Report", attachment: "uploads/report.pdf" }}
        model={model}
      />,
    );

    const link = screen.getByTestId("file-preview-link-attachment");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("uploads/report.pdf");
  });

  it("renders an img element for image file paths", () => {
    const model = defineModel(documentTable, {
      fileFields: { attachment: fm },
      layout: {
        detail: [{ label: "Info", rows: [["attachment"]] }],
      },
    });

    renderWithQuery(
      <FieldDisplay
        fieldName="attachment"
        record={{ id: 1, title: "Photo", attachment: "uploads/photo.jpg" }}
        model={model}
      />,
    );

    const img = screen.getByTestId("file-preview-img-attachment");
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("uploads/photo.jpg");
  });

  it("renders a dash when the file path is empty", () => {
    const model = defineModel(documentTable, {
      fileFields: { attachment: fm },
      layout: {
        detail: [{ label: "Info", rows: [["attachment"]] }],
      },
    });

    renderWithQuery(
      <FieldDisplay
        fieldName="attachment"
        record={{ id: 1, title: "Empty", attachment: "" }}
        model={model}
      />,
    );

    // No preview — just a dash placeholder
    expect(screen.queryByTestId("file-preview-attachment")).toBeNull();
    expect(screen.getByTestId("field-value-attachment").textContent).toBe("—");
  });

  it("renders a regular text value for non-file fields", () => {
    const model = defineModel(documentTable, {
      fileFields: { attachment: fm },
      layout: {
        detail: [{ label: "Info", rows: [["title"]] }],
      },
    });

    renderWithQuery(
      <FieldDisplay
        fieldName="title"
        record={{ id: 1, title: "My Doc", attachment: "" }}
        model={model}
      />,
    );

    // No file preview — just the raw value
    expect(screen.queryByTestId("file-preview-title")).toBeNull();
    expect(screen.getByTestId("field-value-title").textContent).toBe("My Doc");
  });
});

// ---------------------------------------------------------------------------
// 2. FileFieldInput — upload input for members with access (Requirement 6.6)
// ---------------------------------------------------------------------------

describe("FileFieldInput — upload input for members with access", () => {
  it("renders a file upload input when member has a matching group", async () => {
    const app = makeApp(["admin"]);

    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath=""
        fileAccess={["admin"]}
        fileModelColumn={fm}
        session={{ userId: "u1" }}
        app={app}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-field-upload-attachment")).toBeDefined();
    });

    expect(screen.getByTestId("file-field-input-attachment")).toBeDefined();
    expect(
      screen.getByTestId("file-field-input-attachment").getAttribute("type"),
    ).toBe("file");
  });

  it("shows the current file path when one is set and member has access", async () => {
    const app = makeApp(["admin"]);

    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath="uploads/existing.pdf"
        fileAccess={["admin"]}
        fileModelColumn={fm}
        session={{ userId: "u1" }}
        app={app}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-field-current-attachment")).toBeDefined();
    });

    expect(
      screen.getByTestId("file-field-current-attachment").textContent,
    ).toContain("uploads/existing.pdf");
  });
});

// ---------------------------------------------------------------------------
// 3. FileFieldInput — read-only for members without access (Requirement 6.7)
// ---------------------------------------------------------------------------

describe("FileFieldInput — read-only for members without access", () => {
  it("renders read-only display when member has no matching group", async () => {
    const app = makeApp(["viewer"]); // not in ["admin"]

    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath="uploads/report.pdf"
        fileAccess={["admin"]}
        fileModelColumn={fm}
        session={{ userId: "u2" }}
        app={app}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("file-field-readonly-attachment"),
      ).toBeDefined();
    });

    // No upload input
    expect(screen.queryByTestId("file-field-input-attachment")).toBeNull();
    // Shows the current path
    expect(screen.getByTestId("file-field-path-attachment").textContent).toBe(
      "uploads/report.pdf",
    );
  });

  it("renders 'No file' when path is empty and member lacks access", async () => {
    const app = makeApp(["viewer"]);

    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath=""
        fileAccess={["admin"]}
        fileModelColumn={fm}
        session={{ userId: "u2" }}
        app={app}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("file-field-readonly-attachment"),
      ).toBeDefined();
    });

    expect(screen.getByTestId("file-field-empty-attachment").textContent).toBe(
      "No file",
    );
  });

  it("does not render upload or delete controls in read-only mode", async () => {
    const app = makeApp(["viewer"]);

    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath="uploads/file.pdf"
        fileAccess={["admin"]}
        fileModelColumn={fm}
        session={{ userId: "u2" }}
        app={app}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("file-field-readonly-attachment"),
      ).toBeDefined();
    });

    // No file input, no upload button
    expect(screen.queryByTestId("file-field-input-attachment")).toBeNull();
    expect(screen.queryByTestId("file-field-upload-attachment")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. FileFieldInput — read-only when no app/session provided
// ---------------------------------------------------------------------------

describe("FileFieldInput — read-only when no app/session", () => {
  it("renders read-only when app is undefined and fileAccess is non-empty", async () => {
    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath="uploads/file.pdf"
        fileAccess={["admin"]}
        fileModelColumn={fm}
        session={undefined}
        app={undefined}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("file-field-readonly-attachment"),
      ).toBeDefined();
    });

    expect(screen.queryByTestId("file-field-input-attachment")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. FileFieldInput — open access (empty fileAccess)
// ---------------------------------------------------------------------------

describe("FileFieldInput — open access when fileAccess is empty", () => {
  it("renders upload input when fileAccess is empty (open access)", async () => {
    const app = makeApp([]); // no groups needed

    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath=""
        fileAccess={[]}
        fileModelColumn={openFm}
        session={{ userId: "u3" }}
        app={app}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-field-upload-attachment")).toBeDefined();
    });

    expect(screen.getByTestId("file-field-input-attachment")).toBeDefined();
  });

  it("renders upload input when no app but fileAccess is empty", async () => {
    renderWithQuery(
      <FileFieldInput
        fieldName="attachment"
        currentPath=""
        fileAccess={[]}
        fileModelColumn={openFm}
        session={undefined}
        app={undefined}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-field-upload-attachment")).toBeDefined();
    });
  });
});
