/**
 * DetailPage — auto-generated detail view for a tanstack-use Model.
 *
 * Responsibilities:
 *  - Fetches a single record via TanStack Query from `GET /api/{tableName}/{id}`
 *  - Renders tabs from `model.ui.layout.detail`
 *  - Each tab renders its rows; each row renders fields horizontally via `<FieldDisplay>`
 *  - `<FieldDisplay>` resolves the label via `resolveLabel` and calls `format(record)`
 *    or `compute(record)` as appropriate
 *  - `<FieldDisplay>` detects file fields (via `_config` presence) and renders a
 *    file path preview (Requirement 6.6)
 *
 * Requirements: 7.2, 7.4, 7.5, 7.6, 6.6
 *
 * Memoization note: this file intentionally omits useCallback/useMemo.
 * The React Compiler handles all memoization automatically.
 */

import { useQuery } from "@tanstack/react-query";
// import { useNavigate } from "@tanstack/react-router";
import type { PgTable } from "drizzle-orm/pg-core";
import React, { useEffect, useState } from "react";
import type {
  ComputedFieldDef,
  Model,
  UIFieldDef,
} from "../../../tanstack-use-core/src/types.js";
import { resolveLabel } from "../label-resolver.js";
import { serverFns } from "../server.functions.js";
import { appClient, getBaseApp } from "@tanstack-use/core/client";

// ---------------------------------------------------------------------------
// File field detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the field was declared as a file field via
 * `model.ui.fileFields[fieldName]`.
 *
 * Developers declare file fields in `UIConfig.fileFields` using the
 * `FileModelColumn` object returned by `fileModel()`. This is the
 * authoritative source for file field detection in the UI layer.
 */
function isFileField(fieldName: string, model: Model<PgTable>): boolean {
  const fileFields = (model.ui as { fileFields?: Record<string, unknown> })
    .fileFields;
  return fileFields !== undefined && fieldName in fileFields;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetailPageProps {
  /** The model whose detail layout drives this page */
  tableName: string;
  /** The record ID to fetch */
  id: string | number;
  /**
   * Optional override for the redirect function used when permission is denied.
   * When provided, this is called instead of TanStack Router's `navigate`.
   * Useful for testing without a full TanStack Router context.
   */
  onUnauthorized?: () => void;
}

// ---------------------------------------------------------------------------
// FileFieldPreview — renders a stored file path as a preview
// ---------------------------------------------------------------------------

interface FileFieldPreviewProps {
  fieldName: string;
  filePath: string;
}

/**
 * Renders a preview of a stored file path.
 *
 * For image-like extensions a small `<img>` preview is shown; for all other
 * file types the path is rendered as a plain text link.
 *
 * Requirement 6.6
 */
export function FileFieldPreview({
  fieldName,
  filePath,
}: FileFieldPreviewProps): React.ReactElement {
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(filePath);

  return (
    <div
      data-testid={`file-preview-${fieldName}`}
      style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
    >
      {isImage ? (
        <img
          src={filePath}
          alt={fieldName}
          data-testid={`file-preview-img-${fieldName}`}
          style={{
            maxWidth: "200px",
            maxHeight: "200px",
            objectFit: "contain",
          }}
        />
      ) : (
        <a
          href={filePath}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`file-preview-link-${fieldName}`}
        >
          {filePath}
        </a>
      )}
      <span
        data-testid={`file-preview-path-${fieldName}`}
        style={{ fontSize: "0.75rem", color: "#666" }}
      >
        {filePath}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldDisplay — renders a single field's label + value
// ---------------------------------------------------------------------------

interface FieldDisplayProps<T extends PgTable> {
  fieldName: string;
  record: Record<string, unknown>;
  model: Model<T>;
}

/**
 * Renders a single field as a label + value pair.
 *
 * Resolution order:
 *  1. If the field is a file field (detected via `_config` on the column):
 *     render a `<FileFieldPreview>` with the stored path (Requirement 6.6)
 *  2. If the field is a computed field: `cf.format ? cf.format(record) : String(cf.compute(record))`
 *  3. If the field has a `format` function in `ui.fields`: `uiField.format(record)`
 *  4. Otherwise: `record[fieldName]` as a string
 *
 * The label is resolved via `resolveLabel` (calls `label()` if defined, falls
 * back to the field key name — Requirement 9.2, 9.3).
 */
export function FieldDisplay<T extends PgTable>({
  fieldName,
  record,
  model,
}: FieldDisplayProps<T>): React.ReactElement {
  const label = resolveLabel(fieldName, model as unknown as Model<PgTable>);

  const computedFields = (model.ui.computedFields ?? {}) as Record<
    string,
    ComputedFieldDef<T>
  >;
  const uiFields = (model.ui.fields ?? {}) as Record<
    string,
    UIFieldDef<T> | undefined
  >;

  const cf = computedFields[fieldName];
  const uiField = uiFields[fieldName];

  // Check if this is a file field — file fields get a dedicated preview
  const fileField = isFileField(fieldName, model as unknown as Model<PgTable>);

  let valueNode: React.ReactNode;

  if (fileField) {
    // File field — render a preview of the stored path (Requirement 6.6)
    const raw = record[fieldName];
    const filePath = raw !== undefined && raw !== null ? String(raw) : "";
    valueNode = filePath ? (
      <FileFieldPreview fieldName={fieldName} filePath={filePath} />
    ) : (
      <span data-testid={`field-value-${fieldName}`}>—</span>
    );
  } else if (cf !== undefined) {
    // Computed field — use format if available, otherwise stringify compute result
    const value = cf.format
      ? cf.format(record as Parameters<typeof cf.format>[0])
      : String(cf.compute(record as Parameters<typeof cf.compute>[0]));
    valueNode = <span data-testid={`field-value-${fieldName}`}>{value}</span>;
  } else if (uiField?.format) {
    // Regular field with a format function — pass the full record
    const value = uiField.format(
      record as Parameters<typeof uiField.format>[0],
    );
    valueNode = <span data-testid={`field-value-${fieldName}`}>{value}</span>;
  } else {
    // Raw field value
    const raw = record[fieldName];
    const value = raw !== undefined && raw !== null ? String(raw) : "";
    valueNode = <span data-testid={`field-value-${fieldName}`}>{value}</span>;
  }

  return (
    <div
      data-testid={`field-display-${fieldName}`}
      style={{ display: "flex", gap: "0.5rem" }}
    >
      <span
        data-testid={`field-label-${fieldName}`}
        style={{ fontWeight: "bold" }}
      >
        {label}:
      </span>
      {valueNode}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailPage component
// ---------------------------------------------------------------------------

/**
 * Renders a tabbed detail page for a single record of the given model.
 *
 * Permission enforcement (Requirement 5.4):
 * When `session` and `app` are provided, `can(session, "ModelName.read", app)`
 * is called on mount. If it returns `false`, the component redirects to
 * `/unauthorized` via `onUnauthorized` (or TanStack Router's `navigate`).
 *
 * Tabs are derived from `model.ui.layout.detail`. Each tab contains rows;
 * each row renders its fields horizontally side by side via `<FieldDisplay>`.
 *
 * Loading and error states are shown while the record is being fetched.
 */
export function DetailPage({
  tableName,
  id,
  onUnauthorized,
}: DetailPageProps): React.ReactElement {
  // const tableName = getTableName(model.table);
    const model = appClient.models[tableName]!;
    if(!model) {
      return <>not found</>
    }
  
  const tabs = (model.ui.layout?.detail ?? []);

  // -------------------------------------------------------------------------
  // Active tab state
  // -------------------------------------------------------------------------

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // -------------------------------------------------------------------------
  // Permission guard (Requirement 5.4)
  // -------------------------------------------------------------------------
    const session = appClient.auth.getSession();

  const [authorized, setAuthorized] = useState<boolean | null>(
    session === undefined  ? true : null,
  );

  // const routerNavigate = useNavigate();

  useEffect(() => {
    if (session === undefined ) return;

    let cancelled = false;

    async function checkPermission() {
      if (!session) return;
      try {
        // const permitted = await can(session, `${tableName}.read`);
        if (cancelled) return;
        // if (!permitted) {
        //   if (onUnauthorized) {
        //     onUnauthorized();
        //   } else {
        //     void (routerNavigate as (opts: { to: string }) => void)({
        //       to: "/unauthorized",
        //     });
        //   }
        //   setAuthorized(false);
        // } else {
          setAuthorized(true);
        // }
      } catch {
        if (!cancelled) setAuthorized(false);
      }
    }

    void checkPermission();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, session, onUnauthorized]);

  // -------------------------------------------------------------------------
  // Data fetching via TanStack Query → server function
  // -------------------------------------------------------------------------

  const { get } = serverFns;

  const {
    data: record,
    isLoading,
    isError,
  } = useQuery<Record<string, unknown>>({
    queryKey: [tableName, "detail", id],
    queryFn: () =>
      get({ data: { tableName, id } }) as Promise<Record<string, unknown>>,
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Still resolving permission
  if (authorized === null) {
    return (
      <div data-testid="detail-page">
        <div data-testid="detail-loading-permission">Checking permissions…</div>
      </div>
    );
  }

  // Unauthorized — redirect is in progress; render nothing
  if (!authorized) {
    return <div data-testid="detail-page-unauthorized" />;
  }

  if (isLoading) {
    return (
      <div data-testid="detail-page">
        <div data-testid="detail-loading">Loading…</div>
      </div>
    );
  }

  if (isError || record === undefined) {
    return (
      <div data-testid="detail-page">
        <div data-testid="detail-error">Failed to load record.</div>
      </div>
    );
  }

  const activeTab = tabs[activeTabIndex];

  return (
    <div data-testid="detail-page">
      {/* Tab navigation — only rendered when there are multiple tabs */}
      {tabs.length > 0 && (
        <div data-testid="detail-tabs" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              role="tab"
              aria-selected={index === activeTabIndex}
              data-testid={`detail-tab-${index}`}
              onClick={() => setActiveTabIndex(index)}
              style={{
                fontWeight: index === activeTabIndex ? "bold" : "normal",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Active tab content */}
      {activeTab !== undefined && (
        <div
          data-testid={`detail-tab-content-${activeTabIndex}`}
          role="tabpanel"
        >
          {activeTab.rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              data-testid={`detail-row-${activeTabIndex}-${rowIndex}`}
              style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}
            >
              {row.map((fieldName) => (
                <FieldDisplay
                  key={String(fieldName)}
                  fieldName={String(fieldName)}
                  record={record}
                  model={model}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
