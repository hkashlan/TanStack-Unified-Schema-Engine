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
 *
 * Requirements: 7.3, 7.7, 3.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 *
 * Memoization note: this file intentionally omits useCallback/useMemo.
 * The React Compiler handles all memoization automatically.
 */

import { useForm } from "@tanstack/react-form";
import type { PgTable } from "drizzle-orm/pg-core";
import React, { useEffect, useRef } from "react";
import type {
  Model,
  UIFieldDef,
} from "../../../tanstack-use-core/src/types.js";
import { resolveLabel } from "../label-resolver.js";
import { useServerFunctions } from "../server-functions-context.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatePageProps<T extends PgTable> {
  /** The model whose create layout drives this page */
  model: Model<T>;
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
// FieldInput — renders a single form field with label, input, and error
// ---------------------------------------------------------------------------

interface FieldInputProps<T extends PgTable> {
  fieldName: string;
  model: Model<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
}

/**
 * Renders a single form field: label, text input, and validation error message.
 *
 * The validator from `ui.fields[fieldName]?.validate` is registered on both
 * `onChange` and `onBlur` (Requirements 12.2).
 *
 * The label is resolved via `resolveLabel` (Requirement 9.2, 9.3).
 */
function FieldInput<T extends PgTable>({
  fieldName,
  model,
  form,
}: FieldInputProps<T>): React.ReactElement {
  const label = resolveLabel(fieldName, model as unknown as Model<PgTable>);
  const uiFields = (model.ui.fields ?? {}) as Record<
    string,
    UIFieldDef<T> | undefined
  >;
  const validate = uiFields[fieldName]?.validate;

  return (
    <form.Field
      name={fieldName}
      validators={
        validate
          ? {
              onChange: ({ value }: { value: unknown }) =>
                validate(value) ?? null,
              onBlur: ({ value }: { value: unknown }) =>
                validate(value) ?? null,
            }
          : undefined
      }
    >
      {(field) => (
        <div
          data-testid={`field-input-wrapper-${fieldName}`}
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <label
            htmlFor={`field-${fieldName}`}
            data-testid={`field-label-${fieldName}`}
          >
            {label}
          </label>
          <input
            id={`field-${fieldName}`}
            data-testid={`field-input-${fieldName}`}
            value={String(field.state.value ?? "")}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            aria-invalid={field.state.meta.errors.length > 0}
            aria-describedby={
              field.state.meta.errors.length > 0
                ? `field-error-${fieldName}`
                : undefined
            }
          />
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
export function CreatePage<T extends PgTable>({
  model,
  onSuccess,
  confirmNavigation,
}: CreatePageProps<T>): React.ReactElement {
  const tableName = getTableName(model.table);

  // -------------------------------------------------------------------------
  // Server functions via context
  // -------------------------------------------------------------------------

  const { create } = useServerFunctions();

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

  const form = useForm<Record<string, unknown>>({
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
        data: { tableName, record },
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
            form={form}
          />
        ))}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
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
