/**
 * ListPage — auto-generated list view for a tanstack-use Model.
 *
 * Responsibilities:
 *  - Derives TanStack Table column definitions from `model.ui.layout.list`
 *  - Fetches records via TanStack Query from `GET /api/{tableName}`
 *  - Debounces the search input via setTimeout (debounce pattern)
 *  - Reflects sort state and pagination in the URL via TanStack Router search params
 *
 * Requirements: 7.1, 7.4, 3.3, 11.1, 11.2, 11.3, 11.5, 11.7
 *
 * Memoization note: this file intentionally omits useCallback/useMemo.
 * The React Compiler handles all memoization automatically.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { can } from "@tanstack-use/permissions";
import type { PgTable } from "drizzle-orm/pg-core";
import React, { useEffect, useRef, useState } from "react";
import type {
  App,
  ComputedFieldDef,
  Model,
  UIFieldDef,
} from "../../../tanstack-use-core/src/types.js";
import { resolveLabel } from "../label-resolver.js";
import type { ModelServerFns } from "../server-functions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListPageProps<T extends PgTable> {
  /** The model whose list layout drives this page */
  model: Model<T>;
  /**
   * Server functions scoped to this model — created via `createModelServerFns`
   * at module level in the route file.
   */
  serverFns: ModelServerFns;
  /**
   * The current user session. Required for permission enforcement.
   * When absent, permission checks are skipped (open access assumed).
   */
  session?: unknown;
  /**
   * The App registry. Required for permission enforcement via `can()`.
   * When absent, permission checks are skipped (open access assumed).
   */
  app?: App;
  /**
   * Optional override for the current search params.
   * When provided, the component uses these instead of calling `useSearch()`.
   * Useful for testing without a full TanStack Router context.
   */
  searchParams?: Record<string, unknown>;
  /**
   * Optional override for the navigate function.
   * When provided, the component calls this instead of `useNavigate()`.
   * Useful for testing without a full TanStack Router context.
   */
  onNavigate?: (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  /**
   * Optional override for the redirect function used when permission is denied.
   * When provided, this is called instead of TanStack Router's `navigate`.
   * Useful for testing without a full TanStack Router context.
   */
  onUnauthorized?: () => void;
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
// Router-aware sub-component
//
// Splitting into two components is the clean alternative to the try/catch
// around hook calls. RouterAwareListPage is only rendered when a TanStack
// Router context is present; ListPageCore handles the rest of the logic and
// accepts explicit searchParams/onNavigate props in both cases.
// ---------------------------------------------------------------------------

/**
 * Reads sort/pagination state from the URL and passes it down to ListPageCore.
 * Only rendered when a TanStack Router context is available.
 */
function RouterAwareListPage<T extends PgTable>(
  props: Omit<ListPageProps<T>, "searchParams" | "onNavigate">,
): React.ReactElement {
  const routerSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const routerNavigate = useNavigate();

  function handleNavigate(
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) {
    void (routerNavigate as (opts: { search: unknown }) => void)({
      search: updater,
    });
  }

  return (
    <ListPageCore
      {...props}
      searchParams={routerSearch}
      onNavigate={handleNavigate}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a paginated, sortable, searchable list page for the given model.
 *
 * Permission enforcement (Requirement 5.4):
 * When `session` and `app` are provided, `can(session, "ModelName.read", app)`
 * is called on mount. If it returns `false`, the component redirects to
 * `/unauthorized` via `onUnauthorized` (or TanStack Router's `navigate`).
 *
 * In production, render via `<ListPage>` which automatically wires TanStack
 * Router search params. Pass `searchParams` and `onNavigate` props directly
 * when a router context is unavailable (e.g. in tests).
 */
export function ListPage<T extends PgTable>(
  props: ListPageProps<T>,
): React.ReactElement {
  // When explicit overrides are provided (tests, Storybook, etc.) skip the
  // router hooks entirely — no context needed.
  if (props.searchParams !== undefined || props.onNavigate !== undefined) {
    return (
      <ListPageCore
        {...props}
        searchParams={props.searchParams ?? {}}
        onNavigate={props.onNavigate ?? (() => undefined)}
      />
    );
  }

  return <RouterAwareListPage {...props} />;
}

// ---------------------------------------------------------------------------
// Core implementation — receives searchParams and onNavigate as plain props
// ---------------------------------------------------------------------------

interface ListPageCoreProps<T extends PgTable> extends Omit<
  ListPageProps<T>,
  "searchParams" | "onNavigate"
> {
  searchParams: Record<string, unknown>;
  onNavigate: (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
}

function ListPageCore<T extends PgTable>({
  model,
  serverFns,
  session,
  app,
  searchParams,
  onNavigate,
  onUnauthorized,
}: ListPageCoreProps<T>): React.ReactElement {
  const tableName = getTableName(model.table);
  const listFields = model.ui.layout?.list ?? [];
  const debounceMs = model.ui.layout?.listOptions?.searchDebounceMs ?? 300;

  // -------------------------------------------------------------------------
  // Permission guard (Requirement 5.4)
  // -------------------------------------------------------------------------

  const [authorized, setAuthorized] = useState<boolean | null>(
    // Skip check when session/app are absent — treat as open access
    session === undefined || app === undefined ? true : null,
  );

  const routerNavigate = useNavigate();

  useEffect(() => {
    if (session === undefined || app === undefined) return;

    let cancelled = false;

    async function checkPermission() {
      if (!app || !session) return;
      try {
        const permitted = await can(session, `${tableName}.read`, app);
        if (cancelled) return;
        if (!permitted) {
          if (onUnauthorized) {
            onUnauthorized();
          } else {
            void (routerNavigate as (opts: { to: string }) => void)({
              to: "/unauthorized",
            });
          }
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      } catch {
        if (!cancelled) setAuthorized(false);
      }
    }

    void checkPermission();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, session, app, onUnauthorized]);

  // -------------------------------------------------------------------------
  // Server functions via prop
  // -------------------------------------------------------------------------

  const { list } = serverFns;

  // -------------------------------------------------------------------------
  // Search state — raw input value + debounced value sent to the query
  // -------------------------------------------------------------------------

  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = (e.nativeEvent.target as unknown as { value: string }).value;
    setRawSearch(value);

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      debounceTimerRef.current = null;
    }, debounceMs);
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Sort + pagination state derived from URL search params
  // -------------------------------------------------------------------------

  const sortBy = searchParams["sortBy"];
  const sortDir = searchParams["sortDir"];
  const sorting: SortingState =
    typeof sortBy === "string"
      ? [{ id: sortBy, desc: sortDir === "desc" }]
      : [];

  const rawPage = Number(searchParams["page"] ?? 0);
  const rawPageSize = Number(searchParams["pageSize"] ?? 20);
  const pagination: PaginationState = {
    pageIndex: isNaN(rawPage) ? 0 : rawPage,
    pageSize: isNaN(rawPageSize) ? 20 : rawPageSize,
  };

  function setSorting(
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const first = next[0];
    onNavigate((prev) => ({
      ...prev,
      sortBy: first?.id,
      sortDir: first?.desc ? "desc" : "asc",
      page: 0,
    }));
  }

  function setPagination(
    updater: PaginationState | ((prev: PaginationState) => PaginationState),
  ) {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    onNavigate((prev) => ({
      ...prev,
      page: next.pageIndex,
      pageSize: next.pageSize,
    }));
  }

  // -------------------------------------------------------------------------
  // Data fetching via TanStack Query → server function
  // -------------------------------------------------------------------------

  const {
    data = [],
    isLoading,
    isError,
  } = useQuery<Record<string, unknown>[]>({
    queryKey: [tableName, "list", debouncedSearch, sorting, pagination],
    queryFn: () =>
      list({
        data: {
          tableName,
          search: debouncedSearch || undefined,
          sortBy: sorting[0]?.id,
          sortDir: sorting[0]?.desc ? "desc" : "asc",
          page: pagination.pageIndex,
          pageSize: pagination.pageSize,
        },
      }) as Promise<Record<string, unknown>[]>,
  });

  // -------------------------------------------------------------------------
  // Column definitions derived from ui.layout.list
  // -------------------------------------------------------------------------

  const computedFields = (model.ui.computedFields ?? {}) as Record<
    string,
    ComputedFieldDef<T>
  >;
  const uiFields = (model.ui.fields ?? {}) as Record<
    string,
    UIFieldDef<T> | undefined
  >;

  const columns: ColumnDef<Record<string, unknown>>[] = listFields.map(
    (col) => {
      const colKey = col as string;
      const cf = computedFields[colKey];
      const uiField = uiFields[colKey];

      return {
        id: colKey,
        accessorKey: colKey,
        header: () => resolveLabel(colKey, model as unknown as Model<PgTable>),
        cell: ({ row }) => {
          const record = row.original as Record<string, unknown>;
          if (cf !== undefined) {
            return cf.format
              ? cf.format(record as Parameters<typeof cf.format>[0])
              : String(cf.compute(record as Parameters<typeof cf.compute>[0]));
          }
          if (uiField?.format) {
            return uiField.format(
              record as Parameters<typeof uiField.format>[0],
            );
          }
          const value = record[colKey];
          return value !== undefined && value !== null ? String(value) : "";
        },
      };
    },
  );

  // -------------------------------------------------------------------------
  // TanStack Table instance
  // -------------------------------------------------------------------------

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Still resolving permission
  if (authorized === null) {
    return (
      <div data-testid="list-page-loading-permission">
        Checking permissions…
      </div>
    );
  }

  // Unauthorized — redirect is in progress; render nothing
  if (!authorized) {
    return <div data-testid="list-page-unauthorized" />;
  }

  return (
    <div data-testid="list-page">
      {/* Search input — debounced via setTimeout */}
      <input
        data-testid="list-search"
        type="search"
        placeholder="Search…"
        value={rawSearch}
        onChange={handleSearchChange}
        aria-label="Search"
      />

      {/* Error state */}
      {isError && <div data-testid="list-error">Failed to load data.</div>}

      {/* Table — always rendered so headers are accessible even during loading */}
      <table data-testid="list-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: header.column.getCanSort() ? "pointer" : "default",
                  }}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "none"
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  {header.column.getIsSorted() === "asc"
                    ? " ↑"
                    : header.column.getIsSorted() === "desc"
                      ? " ↓"
                      : ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} data-testid="list-loading">
                Loading…
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination controls */}
      <div data-testid="list-pagination">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          ←
        </button>
        <span>Page {pagination.pageIndex + 1}</span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          →
        </button>
      </div>
    </div>
  );
}
