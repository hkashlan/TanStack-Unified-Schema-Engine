/**
 * DetailPage — auto-generated detail view for a tanstack-use Model.
 *
 * Responsibilities:
 *  - Fetches a single record via TanStack Query from `GET /api/{tableName}/{id}`
 *  - Renders tabs from `model.ui.layout.detail`
 *  - Each tab renders its rows; each row renders fields horizontally via `<FieldDisplay>`
 *  - `<FieldDisplay>` resolves the label via `resolveLabel` and calls `format(record)`
 *    or `compute(record)` as appropriate
 *
 * Requirements: 7.2, 7.4, 7.5, 7.6
 *
 * Memoization note: this file intentionally omits useCallback/useMemo.
 * The React Compiler handles all memoization automatically.
 */

import { useQuery } from "@tanstack/react-query";
import type { PgTable } from "drizzle-orm/pg-core";
import React, { useState } from "react";
import type {
  ComputedFieldDef,
  Model,
  TabDef,
  UIFieldDef,
} from "../../../tanstack-use-core/src/types.js";
import { resolveLabel } from "../label-resolver.js";
import { useServerFunctions } from "../server-functions-context.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetailPageProps<T extends PgTable> {
  /** The model whose detail layout drives this page */
  model: Model<T>;
  /** The record ID to fetch */
  id: string | number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the Drizzle table name from the Symbol-keyed property. */
function getTableName(table: PgTable): string {
  return (table as unknown as Record<symbol, unknown>)[
    Symbol.for("drizzle:Name")
  ] as string;
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
 *  1. If the field is a computed field: `cf.format ? cf.format(record) : String(cf.compute(record))`
 *  2. If the field has a `format` function in `ui.fields`: `uiField.format(record)`
 *  3. Otherwise: `record[fieldName]` as a string
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

  let value: string;
  if (cf !== undefined) {
    // Computed field — use format if available, otherwise stringify compute result
    value = cf.format
      ? cf.format(record as Parameters<typeof cf.format>[0])
      : String(cf.compute(record as Parameters<typeof cf.compute>[0]));
  } else if (uiField?.format) {
    // Regular field with a format function — pass the full record
    value = uiField.format(record as Parameters<typeof uiField.format>[0]);
  } else {
    // Raw field value
    const raw = record[fieldName];
    value = raw !== undefined && raw !== null ? String(raw) : "";
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
      <span data-testid={`field-value-${fieldName}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailPage component
// ---------------------------------------------------------------------------

/**
 * Renders a tabbed detail page for a single record of the given model.
 *
 * Tabs are derived from `model.ui.layout.detail`. Each tab contains rows;
 * each row renders its fields horizontally side by side via `<FieldDisplay>`.
 *
 * Loading and error states are shown while the record is being fetched.
 */
export function DetailPage<T extends PgTable>({
  model,
  id,
}: DetailPageProps<T>): React.ReactElement {
  const tableName = getTableName(model.table);
  const tabs = (model.ui.layout?.detail ?? []) as TabDef<
    T,
    Record<string, ComputedFieldDef<T>>
  >[];

  // -------------------------------------------------------------------------
  // Active tab state
  // -------------------------------------------------------------------------

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // -------------------------------------------------------------------------
  // Data fetching via TanStack Query → server function
  // -------------------------------------------------------------------------

  const { get } = useServerFunctions();

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
