import type { Session } from "better-auth";
import type { PgTable } from "drizzle-orm/pg-core";

/** Alias for the Better Auth session type */
export type BetterAuthSession = Session;

/**
 * Minimal structural interface for the Better Auth instance.
 * The framework only calls `auth.api.getActiveMemberGroups(session)` at
 * runtime — the full BetterAuth generic type is not needed here.
 */
export interface BetterAuthInstance {
  api: {
    getActiveMemberGroups: (session: unknown) => Promise<string[]>;
  };
}

/** Infer the record type from a Drizzle PgTable */
export type InferRecord<T extends PgTable> = T["$inferSelect"];

/** All field keys: column keys + computed field keys */
export type AllFieldKeys<T extends PgTable, TComputed extends Record<string, ComputedFieldDef<T>>> =
  | keyof T["_"]["columns"]
  | keyof TComputed;

/** A computed field — compute and format both receive the full typed record */
export interface ComputedFieldDef<T extends PgTable> {
  dependsOn: [keyof T["_"]["columns"], ...(keyof T["_"]["columns"])[]]; // non-empty tuple
  compute: (record: InferRecord<T>) => unknown;
  format?: (record: InferRecord<T>) => string;
}

/**
 * Per-field UI override.
 *
 * `label` is a zero-argument function returning the display string.
 * Pass a Paraglide message function (e.g. `label: m.employeeName`) for
 * reactive i18n, or a plain arrow function for static text: `() => "Full Name"`.
 * The function is called on every render, so locale switches are automatically
 * reflected. Falls back to the field key name when absent.
 */
export interface UIFieldDef<T extends PgTable> {
  label?: () => string;
  format?: (record: InferRecord<T>) => string;
  hidden?: boolean | ((record: InferRecord<T>) => boolean);
}

export interface TabDef<T extends PgTable, TComputed extends Record<string, ComputedFieldDef<T>>> {
  label: string;
  rows: AllFieldKeys<T, TComputed>[][];
}

export interface LayoutDef<
  T extends PgTable,
  TComputed extends Record<string, ComputedFieldDef<T>>,
> {
  list?: AllFieldKeys<T, TComputed>[]; // absent → no list page
  detail?: TabDef<T, TComputed>[]; // absent → no detail page
  create?: AllFieldKeys<T, TComputed>[]; // absent → no create page
}

export interface PermissionsDef {
  read?: string[]; // Better Auth group names
  create?: string[];
  update?: string[];
  delete?: string[];
}

export interface ServerHooks<T extends PgTable> {
  beforeCreate?: (ctx: { record: InferRecord<T>; session: BetterAuthSession }) => Promise<void>;
  afterCreate?: (ctx: { record: InferRecord<T>; session: BetterAuthSession }) => Promise<void>;
  beforeUpdate?: (ctx: { record: InferRecord<T>; session: BetterAuthSession }) => Promise<void>;
  afterUpdate?: (ctx: { record: InferRecord<T>; session: BetterAuthSession }) => Promise<void>;
}

export interface ClientHooks<T extends PgTable> {
  onSubmit?: (record: InferRecord<T>) => InferRecord<T> | Promise<InferRecord<T>>;
}

export interface UIConfig<T extends PgTable> {
  fields?: Partial<Record<keyof T["_"]["columns"], UIFieldDef<T>>>;
  computedFields?: Record<string, ComputedFieldDef<T>>;
  layout?: LayoutDef<T, Record<string, ComputedFieldDef<T>>>;
  permissions?: PermissionsDef;
  server?: ServerHooks<T>;
  client?: ClientHooks<T>;
}

export interface Model<T extends PgTable> {
  _tag: "Model";
  table: T;
  ui: UIConfig<T>;
}

export interface App {
  _tag: "App";
  models: Map<string, Model<PgTable>>;
  auth: BetterAuthInstance;
}
