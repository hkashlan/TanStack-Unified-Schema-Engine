/**
 * CreatePage — auto-generated create form for a tanstack-use Model.
 *
 * Responsibilities:
 *  - Filters `model.ui.layout.create` to exclude computed field keys
 *  - Uses TanStack Form `useForm` with field validators from `ui.fields[fieldName]?.validate`
 *  - Validators run on change and on blur per field
 *  - Displays validation error messages below each field
 *  - Disables the submit button while submitting or while any field has a validation error
 *  - Implements handleSubmit: calls `model.ui.client?.onSubmit` if defined, then POSTs to `/api/{tableName}`
 *  - Adds a dirty-state navigation guard via TanStack Router's `onBeforeLoad` that prompts
 *    the user before leaving an unsaved form
 *  - Detects file fields (via `_config` on the column) and renders a file upload input
 *    for members with access, or a read-only display for those without (Requirements 6.6, 6.7)
 *
 * Requirements: 7.3, 7.7, 3.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 6.6, 6.7
 *
 * Memoization note: this file intentionally omits useCallback/useMemo.
 * The React Compiler handles all memoization automatically.
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: no explain */

import { useForm, type ReactFormExtendedApi } from "@tanstack/react-form";
// import { useNavigate } from "@tanstack/react-router";
import type { PgTable } from "drizzle-orm/pg-core";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Model, RegisteredApp, UIFieldDef } from "../../../tanstack-use-core/src/types.js";
import { resolveLabel } from "../label-resolver.js";
import { serverFns } from "../server.functions.js";
import { getModel, type SessionClient } from "@tanstack-use/core/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatePageProps {
  /** The model whose create layout drives this page */
  modelKey: keyof RegisteredApp["models"];
  /**
   * The current session, passed down from the route context.
   * Avoids a redundant `getSession()` API call — the session was already
   * fetched once in the `_authenticated` layout's `beforeLoad`.
   */
  session: SessionClient;
  /**
   * Called after a successful submission with the server response.
   * Useful for navigation (e.g. redirect to the detail page).
   */
  onSuccess?: (record: Record<string, unknown>) => void;
  /**
   * Optional override for the navigation guard prompt.
   * When provided, this function is called instead of `window.confirm` when
   * the user tries to navigate away from a dirty form.
   * Return `true` to allow navigation, `false` to block it.
   * Useful for testing without a real browser confirm dialog.
   */
  confirmNavigation?: () => boolean;
  /**
   * Optional override for the redirect function used when permission is denied.
   * When provided, this is called instead of TanStack Router's `navigate`.
   * Useful for testing without a full TanStack Router context.
   */
  onUnauthorized?: () => void;
}

// ---------------------------------------------------------------------------
// File field detection
// ---------------------------------------------------------------------------

/**
 * Returns the `_config` object when the field was declared as a file field
 * via `model.ui.fileFields[fieldName]`, or `undefined` for regular fields.
 *
 * Developers declare file fields in `UIConfig.fileFields` using the
 * `FileModelColumn` object returned by `fileModel()`.
 */
function getFileFieldConfig(
  fieldName: string,
  model: Model<PgTable>,
): { fileAccess?: string[]; storage: unknown } | undefined {
  const fileFields = (
    model.ui as {
      fileFields?: Record<string, { _config: { fileAccess?: string[]; storage: unknown } }>;
    }
  ).fileFields;
  if (!fileFields) return undefined;
  return fileFields[fieldName]?._config;
}

// ---------------------------------------------------------------------------
// FileFieldInput — file upload input with access control
// ---------------------------------------------------------------------------

interface FileFieldInputProps {
  fieldName: string;
  currentPath: string;
  fileAccess: string[];
  /** The FileModelColumn object from model.ui.fileFields — used for upload operations */
  fileModelColumn: { _config: { storage: unknown; fileAccess?: string[] } };
  session: SessionClient;
  onUpload: (path: string) => void;
}

/**
 * Renders a file upload input for members with upload access, or a read-only
 * display for those without.
 *
 * Access is determined by checking whether the session's member groups
 * intersect `fileAccess`. When `app` or `session` is absent, falls back to
 * read-only.
 *
 * Requirements 6.6, 6.7
 */
export function FileFieldInput({
  fieldName,
  currentPath,
  fileAccess,
  fileModelColumn: _fileModelColumn,
  session,
  onUpload: _onUpload,
}: FileFieldInputProps): React.ReactElement {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [uploading, _setUploading] = useState(false);
  const [uploadError, _setUploadError] = useState<string | null>(null);

  // Resolve upload access asynchronously
  useEffect(() => {
    if (!session) {
      // No app/session — treat as no access (read-only)
      setHasAccess(fileAccess.length === 0);
      return;
    }

    let cancelled = false;

    async function checkAccess() {
      try {
        if (fileAccess.length === 0) {
          if (!cancelled) setHasAccess(true);
          return;
        }
        // todo hadi
        // const memberGroups = await app.auth.api.getActiveMemberGroups(session);
        // const permitted = memberGroups.some((g) => fileAccess.includes(g));
        // if (!cancelled) setHasAccess(permitted);
      } catch {
        if (!cancelled) setHasAccess(false);
      }
    }

    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, [session, fileAccess]);

  async function handleFileChange(_e: React.ChangeEvent<HTMLInputElement>) {
    // const files = (e.nativeEvent.target as unknown as HTMLInputElement).files;
    // const file = files?.[0];
    // if (!file || !app) return;
    // setUploading(true);
    // setUploadError(null);
    // try {
    //   const { handleUpload } =
    //     await import("../../../tanstack-use-files/src/file-handler.js");
    //   const path = await handleUpload(
    //     {
    //       session,
    //       fileModelColumn: fileModelColumn as unknown as Parameters<
    //         typeof handleUpload
    //       >[0]["fileModelColumn"],
    //       file,
    //     },
    //     app,
    //   );
    //   onUpload(path);
    // } catch (err) {
    //   setUploadError(err instanceof Error ? err.message : "Upload failed");
    // } finally {
    //   setUploading(false);
    // }
  }

  // Still resolving access
  if (hasAccess === null) {
    return (
      <div data-testid={`file-field-loading-${fieldName}`}>
        <span>Loading…</span>
      </div>
    );
  }

  if (!hasAccess) {
    // Read-only display — no upload or delete controls (Requirement 6.7)
    return (
      <div data-testid={`file-field-readonly-${fieldName}`}>
        {currentPath ? (
          <span data-testid={`file-field-path-${fieldName}`}>{currentPath}</span>
        ) : (
          <span data-testid={`file-field-empty-${fieldName}`}>No file</span>
        )}
      </div>
    );
  }

  // Upload input — member has access (Requirement 6.6)
  return (
    <div data-testid={`file-field-upload-${fieldName}`}>
      {currentPath && (
        <span
          data-testid={`file-field-current-${fieldName}`}
          style={{ fontSize: "0.875rem", color: "#666" }}
        >
          Current: {currentPath}
        </span>
      )}
      <input
        type="file"
        data-testid={`file-field-input-${fieldName}`}
        disabled={uploading}
        onChange={handleFileChange}
        aria-label={`Upload ${fieldName}`}
      />
      {uploading && <span data-testid={`file-field-uploading-${fieldName}`}>Uploading…</span>}
      {uploadError && (
        <span data-testid={`file-field-error-${fieldName}`} role="alert" style={{ color: "red" }}>
          {uploadError}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldInput — renders a single form field with label, input, and error
// ---------------------------------------------------------------------------

// Convenience alias for the form instance type used throughout this file.
// Uses `any` for all type parameters to accept any form instance regardless
// of its validator configuration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormInstance = ReactFormExtendedApi<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

interface FieldInputProps {
  fieldName: string;
  model: Model;
  form: AnyFormInstance;
  session: SessionClient;
}

/**
 * Renders a single form field: label, text input (or file upload), and
 * validation error message.
 *
 * When the column was produced by `fileModel()`, renders a `<FileFieldInput>`
 * instead of a plain text input. The `session` and `app` props are forwarded
 * to `<FileFieldInput>` for access control (Requirements 6.6, 6.7).
 *
 * The validator from `ui.fields[fieldName]?.validate` is registered on both
 * `onChange` and `onBlur` (Requirements 12.2).
 *
 * The label is resolved via `resolveLabel` (Requirement 9.2, 9.3).
 */
export function FieldInput<T extends PgTable>({
  fieldName,
  model,
  form,
  session,
}: FieldInputProps): React.ReactElement {
  const label = resolveLabel(fieldName, model as unknown as Model<PgTable>);
  const uiFields = (model.ui.fields ?? {}) as Record<string, UIFieldDef<T> | undefined>;
  const validate = uiFields[fieldName]?.validate;

  // Detect file fields
  const fileConfig = getFileFieldConfig(fieldName, model as unknown as Model<PgTable>);

  return (
    <form.Field
      name={fieldName}
      {...(validate
        ? {
            validators: {
              onChange: ({ value }: { value: unknown }) => validate(value) ?? null,
              onBlur: ({ value }: { value: unknown }) => validate(value) ?? null,
            },
          }
        : {})}
    >
      {(field) => (
        <div
          data-testid={`field-input-wrapper-${fieldName}`}
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <label htmlFor={`field-${fieldName}`} data-testid={`field-label-${fieldName}`}>
            {label}
          </label>

          {fileConfig ? (
            // File field — render upload input or read-only display
            <FileFieldInput
              fieldName={fieldName}
              currentPath={String(field.state.value ?? "")}
              fileAccess={fileConfig.fileAccess ?? []}
              fileModelColumn={{ _config: fileConfig }}
              session={session}
              onUpload={(path) => field.handleChange(path)}
            />
          ) : (
            // Regular text input
            <input
              id={`field-${fieldName}`}
              data-testid={`field-input-${fieldName}`}
              value={String(field.state.value ?? "")}
              onChange={(e) =>
                field.handleChange((e.nativeEvent.target as unknown as { value: string }).value)
              }
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.errors.length > 0}
              aria-describedby={
                field.state.meta.errors.length > 0 ? `field-error-${fieldName}` : undefined
              }
            />
          )}

          {field.state.meta.errors.length > 0 && (
            <span
              id={`field-error-${fieldName}`}
              data-testid={`field-error-${fieldName}`}
              role="alert"
              style={{ color: "red", fontSize: "0.875rem" }}
            >
              {field.state.meta.errors.filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      )}
    </form.Field>
  );
}

// ---------------------------------------------------------------------------
// CreatePage component
// ---------------------------------------------------------------------------

/**
 * Renders a validated create form for the given model.
 *
 * Fields are derived from `model.ui.layout.create`, with computed fields
 * excluded (Requirement 3.2). Each field uses `resolveLabel` for its label
 * and registers the `validate` function from `ui.fields` as a TanStack Form
 * field-level validator running on change and blur (Requirement 12.2).
 *
 * On submit:
 *  1. If `model.ui.client?.onSubmit` is defined, it is called with the
 *     validated record values and its return value is used as the payload
 *     (Requirement 7.7, 12.5).
 *  2. The payload is POSTed to `/api/{tableName}`.
 *
 * The submit button is disabled while the form is submitting or while any
 * field has a validation error (Requirement 12.4).
 *
 * A dirty-state navigation guard is registered via a `beforeunload` event
 * listener that prompts the user before leaving an unsaved form
 * (Requirement 12.6). The `confirmNavigation` prop can override the confirm
 * dialog for testing.
 */
export function CreatePage({
  modelKey,
  session,
  onSuccess,
  confirmNavigation,
  onUnauthorized,
}: CreatePageProps): React.ReactElement {
  // const tableName = getTableName(model.table);
  const model = getModel(modelKey);
  if (!model) {
    return <>not found</>;
  }

  // -------------------------------------------------------------------------
  // Server functions via prop
  // -------------------------------------------------------------------------

  const { create } = serverFns;

  // -------------------------------------------------------------------------
  // Permission guard (Requirement 5.4)
  // -------------------------------------------------------------------------
  const [authorized, setAuthorized] = useState<boolean | null>(session === undefined ? true : null);

  // const routerNavigate = useNavigate();

  useEffect(() => {
    if (session === undefined) return;

    let cancelled = false;

    async function checkPermission() {
      if (!session) return;
      try {
        // const permitted = await can(session, `${tableName}.create`);
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
  }, [modelKey, session, onUnauthorized]);

  // -------------------------------------------------------------------------
  // Determine which fields to render — exclude computed field keys (Req 3.2)
  // -------------------------------------------------------------------------

  const computedFieldKeys = new Set(Object.keys(model.ui.computedFields ?? {}));
  const createFields = (model.ui.layout?.create ?? [])
    .map((f) => String(f))
    .filter((f) => !computedFieldKeys.has(f));

  // -------------------------------------------------------------------------
  // TanStack Form instance
  // -------------------------------------------------------------------------

  const form = useForm({
    defaultValues: Object.fromEntries(createFields.map((f) => [f, ""])),
    onSubmit: async ({ value }) => {
      let record: Record<string, unknown> = value;

      // Call client onSubmit hook if defined (Requirement 7.7, 12.5)
      if (model.ui.client?.onSubmit) {
        record = (await model.ui.client.onSubmit(
          record as Parameters<typeof model.ui.client.onSubmit>[0],
        )) as Record<string, unknown>;
      }

      const created = (await create({
        data: { modelKey, record },
      })) as Record<string, unknown>;

      onSuccess?.(created);
    },
  });

  // -------------------------------------------------------------------------
  // Dirty-state navigation guard (Requirement 12.6)
  //
  // We register a `beforeunload` handler so the browser prompts the user
  // before closing/refreshing the tab when the form is dirty.
  //
  // For in-app navigation via TanStack Router, the `confirmNavigation` prop
  // (or `window.confirm`) is exposed so callers can wire it into their route's
  // `onBeforeLoad` guard:
  //
  //   beforeLoad: () => {
  //     if (formRef.current?.state.isDirty) {
  //       if (!window.confirm("You have unsaved changes. Leave anyway?")) {
  //         throw redirect({ to: "." });
  //       }
  //     }
  //   }
  //
  // The `data-dirty` attribute on the form element lets tests inspect dirty
  // state without needing access to the form instance directly.
  // -------------------------------------------------------------------------

  const isDirtyRef = useRef(false);

  // Keep the ref in sync with form dirty state on every render
  isDirtyRef.current = form.state.isDirty;

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;

      const shouldLeave = confirmNavigation
        ? confirmNavigation()
        : window.confirm("You have unsaved changes. Leave anyway?");

      if (!shouldLeave) {
        e.preventDefault();
        // Legacy support — some browsers require returnValue to be set
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [confirmNavigation]);

  // -------------------------------------------------------------------------
  // Determine if the submit button should be disabled (Requirement 12.4)
  //
  // Disabled when:
  //  - The form is currently submitting
  //  - Any field has a validation error (canSubmit is false)
  //
  // We use form.Subscribe to reactively track canSubmit and isSubmitting,
  // since form.state is a non-reactive snapshot in the parent component.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Still resolving permission
  if (authorized === null) {
    return <div data-testid="create-page-loading-permission">Checking permissions…</div>;
  }

  // Unauthorized — redirect is in progress; render nothing
  if (!authorized) {
    return <div data-testid="create-page-unauthorized" />;
  }

  return (
    <div data-testid="create-page">
      <form
        data-testid="create-form"
        data-dirty={form.state.isDirty ? "true" : "false"}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        {createFields.map((fieldName) => (
          <FieldInput
            key={fieldName}
            fieldName={fieldName}
            model={model}
            form={form as AnyFormInstance}
            session={session}
          />
        ))}

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => {
            const isSubmitDisabled = isSubmitting || !canSubmit;
            return (
              <button
                type="submit"
                data-testid="create-submit"
                disabled={isSubmitDisabled}
                aria-disabled={isSubmitDisabled}
              >
                {isSubmitting ? "Saving…" : "Save"}
              </button>
            );
          }}
        </form.Subscribe>
      </form>
    </div>
  );
}
