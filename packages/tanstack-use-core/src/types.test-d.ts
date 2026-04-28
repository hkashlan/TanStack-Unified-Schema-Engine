/**
 * Compile-time type tests for tanstack-use-core types.
 * Uses tsd to assert type-level correctness.
 * Requirements: 2.3, 2.5, 3.4, 10.1
 */

import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { expectAssignable, expectError, expectNotAssignable, expectType } from "tsd";
import type { AllFieldKeys, ComputedFieldDef, InferRecord, LayoutDef } from "./types.js";

// ---------------------------------------------------------------------------
// Sample tables used across all tests
// ---------------------------------------------------------------------------

const userTable = pgTable("user", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
});

type UserTable = typeof userTable;

// ---------------------------------------------------------------------------
// Test: InferRecord resolves correctly from a PgTable
// Requirements: 1.4
// ---------------------------------------------------------------------------

type UserRecord = InferRecord<UserTable>;

// id is number (serial → number), name is string, age is number
expectType<number>({} as UserRecord["id"]);
expectType<string>({} as UserRecord["name"]);
expectType<number>({} as UserRecord["age"]);

// The full inferred record should be assignable to the expected shape
expectAssignable<{ id: number; name: string; age: number }>({} as UserRecord);

// ---------------------------------------------------------------------------
// Test: AllFieldKeys includes both column keys and computed field keys
// Requirements: 2.1, 2.2
// ---------------------------------------------------------------------------

type SampleComputed = {
  fullLabel: ComputedFieldDef<UserTable>;
};

type UserAllKeys = AllFieldKeys<UserTable, SampleComputed>;

// Column keys must be included
expectAssignable<UserAllKeys>("id" as const);
expectAssignable<UserAllKeys>("name" as const);
expectAssignable<UserAllKeys>("age" as const);

// Computed field key must be included
expectAssignable<UserAllKeys>("fullLabel" as const);

// A key that is neither a column nor a computed field must NOT be assignable
expectNotAssignable<UserAllKeys>("nonExistentField" as const);

// ---------------------------------------------------------------------------
// Test: Empty dependsOn array produces a type error
// Requirements: 2.4, 2.5, 3.4
// ---------------------------------------------------------------------------

// Valid: non-empty dependsOn — should compile fine
const validComputed: ComputedFieldDef<UserTable> = {
  dependsOn: ["name"],
  compute: (record) => record.name.toUpperCase(),
};
expectAssignable<ComputedFieldDef<UserTable>>(validComputed);

// Invalid: empty dependsOn — must produce a type error
// The type is [keyof T["_"]["columns"], ...(keyof T["_"]["columns"])[]]
// which requires at least one element.
expectError<ComputedFieldDef<UserTable>>({
  dependsOn: [],
  compute: (record: UserRecord) => record.name,
});

// ---------------------------------------------------------------------------
// Test: Layout referencing a non-existent key produces a type error
// Requirements: 2.3
// ---------------------------------------------------------------------------

// Valid layout — all keys exist on the table
const validLayout: LayoutDef<UserTable, SampleComputed> = {
  list: ["id", "name", "fullLabel"],
  detail: [{ label: "Info", rows: [["id", "name"]] }],
  create: ["name", "age"],
};
expectAssignable<LayoutDef<UserTable, SampleComputed>>(validLayout);

// Invalid layout — "nonExistentField" is not a column key or computed field key
expectError<LayoutDef<UserTable, SampleComputed>>({
  list: ["id", "nonExistentField"],
});

// Invalid layout — "ghost" in detail rows
expectError<LayoutDef<UserTable, SampleComputed>>({
  detail: [{ label: "Tab", rows: [["ghost"]] }],
});

// Invalid layout — "missing" in create
expectError<LayoutDef<UserTable, SampleComputed>>({
  create: ["name", "missing"],
});
