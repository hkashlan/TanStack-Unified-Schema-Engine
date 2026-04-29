import type { PgTable } from "drizzle-orm/pg-core";
import type { Model } from "../../tanstack-use-core/src/types.js";

/**
 * Resolves the display label for a field on a model.
 *
 * Calls `ui.fields[fieldName].label()` if defined — the function is invoked on
 * every call so reactive i18n (e.g. Paraglide's `languageTag()`) works without
 * any additional wiring. Falls back to the field key name when absent.
 */
export function resolveLabel(fieldName: string, model: Model<PgTable>): string {
  return (model.ui.fields as Record<string, { label?: () => string } | undefined> | undefined)
    ?.[fieldName]?.label?.() ?? fieldName;
}
