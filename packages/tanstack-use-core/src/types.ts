import type { Session, User } from "better-auth";
import type { createAuthClient } from "better-auth/react";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * The session shape returned by `appClient.auth.useSession().data`.
 * This is NOT the DB session row — it's the client-side session object
 * with both `session` and `user` properties.
 */
export type BetterAuthSession = {
  session: Session;
  user: User;
};

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
  /**
   * TanStack Form field-level validator.
   * Called on change and on blur. Return an error string to block submission,
   * or `undefined` when the value is valid.
   */
  validate?: (value: unknown) => string | undefined;
}

/**
 * Options for the generated list page.
 */
export interface ListOptions {
  /**
   * Debounce delay in milliseconds for the search input.
   * Passed to TanStack Pacer's `useAsyncDebouncer`.
   * @default 300
   */
  searchDebounceMs?: number;
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
  /** Options for the generated list page (search debounce, etc.) */
  listOptions?: ListOptions;
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
  beforeCreate?: (ctx: { record: InferRecord<T>; session?: BetterAuthSession | undefined }) => Promise<void>;
  afterCreate?: (ctx: { record: InferRecord<T>; session?: BetterAuthSession | undefined}) => Promise<void>;
  beforeUpdate?: (ctx: { record: InferRecord<T>; session?: BetterAuthSession | undefined}) => Promise<void>;
  afterUpdate?: (ctx: { record: InferRecord<T>; session?: BetterAuthSession | undefined}) => Promise<void>;
}

export interface ClientHooks<T extends PgTable> {
  onSubmit?: (record: InferRecord<T>) => InferRecord<T> | Promise<InferRecord<T>>;
}

export interface UIConfig<
  T extends PgTable,
  TComputed extends Record<string, ComputedFieldDef<T>> = Record<string, ComputedFieldDef<T>>,
> {
  fields?: Partial<Record<keyof T["_"]["columns"], UIFieldDef<T>>>;
  computedFields?: TComputed;
  layout?: LayoutDef<T, TComputed>;
  permissions?: PermissionsDef;
  server?: ServerHooks<T>;
  client?: ClientHooks<T>;
  /**
   * File field declarations. Maps column keys to `FileModelColumn` objects
   * produced by `fileModel()`. The UI layer uses this to detect file fields
   * and render upload inputs with access control (Requirements 6.6, 6.7).
   *
   * @example
   * ```ts
   * const fm = fileModel({ storage: localDisk(), fileAccess: ["admin"] });
   * const model = defineModel(myTable, {
   *   fileFields: { avatar: fm },
   *   layout: { create: ["name", "avatar"] },
   * });
   * ```
   */
  fileFields?: Partial<
    Record<keyof T["_"]["columns"], { _config: { storage: unknown; fileAccess?: string[] } }>
  >;
}

export interface Model<
  T extends PgTable = PgTable,
  TComputed extends Record<string, ComputedFieldDef<T>> = Record<string, ComputedFieldDef<T>>,
> {
  _tag: "Model";
  table: T;
  ui: UIConfig<T, TComputed>;
}

export interface App<TModels extends Record<string, Model<any, any>> = Record<string, Model<any, any>>> {
  _tag: "App";
  models: TModels;
  auth: ReturnType<typeof createAuthClient>;
}

/**
 * Global type registry for module augmentation.
 * 
 * Augment this interface in your app to make `appClient` fully type-safe:
 * 
 * @example
 * ```ts
 * // src/router.tsx or src/lib/app.ts
 * export const app = defineApp({ models: { todo: todoModel, post: postModel } });
 * 
 * declare module "@tanstack-use/core" {
 *   interface Register {
 *     app: typeof app;
 *   }
 * }
 * 
 * // Now everywhere in your app:
 * import { appClient } from "@tanstack-use/core";
 * appClient.models.todo  // ✓ autocompletes
 * appClient.models.post  // ✓ autocompletes
 * ```
 */
export interface Register {
  // app: App<YourModels>  ← augmented by the consuming app
}

/**
 * Resolves the registered app type, falling back to the base untyped App.
 * This is what `appClient` uses for its type.
 * 
 * When augmented, this becomes the specific app type with known model keys.
 * When not augmented, it's the base `App` with an index signature.
 */
export type RegisteredApp = Register extends { app: infer TApp extends App }
  ? TApp
  : App<Record<string, Model<any, any>>>;

