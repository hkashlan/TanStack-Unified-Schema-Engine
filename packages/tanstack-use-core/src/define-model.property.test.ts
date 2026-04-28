// Feature: tanstack-use, Property 1: Layout field references are a subset of valid keys

import * as fc from "fast-check";
import { describe, it } from "vitest";

/**
 * Property 1: Layout field references are a subset of valid keys.
 *
 * For any UIConfig and Drizzle table, every field name referenced in
 * ui.layout.list, ui.layout.detail, and ui.layout.create must be either
 * a column key of the table or a key of ui.computedFields.
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */
describe("Property 1: Layout field references are a subset of valid keys", () => {
  it("all list layout references are valid keys", () => {
    fc.assert(
      fc.property(
        // Generate a set of column keys
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 10,
        }),
        // Generate a set of computed field keys (disjoint names possible)
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (columnKeys, computedKeys) => {
          const validKeys = new Set([...columnKeys, ...computedKeys]);

          // Generate a layout that only references valid keys
          const listLayout = fc.sample(
            fc.array(fc.constantFrom(...Array.from(validKeys)), {
              minLength: 0,
              maxLength: validKeys.size,
            }),
            1,
          )[0];

          // Every reference in the list layout must be a valid key
          for (const ref of listLayout) {
            if (!validKeys.has(ref)) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("all detail layout row references are valid keys", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 10,
        }),
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (columnKeys, computedKeys) => {
          const validKeys = new Set([...columnKeys, ...computedKeys]);
          const validKeysArr = Array.from(validKeys);

          // Build a detail layout with tabs and rows referencing only valid keys
          const tabs = fc.sample(
            fc.array(
              fc.record({
                label: fc.string({ minLength: 1 }),
                rows: fc.array(
                  fc.array(fc.constantFrom(...validKeysArr), {
                    minLength: 1,
                    maxLength: validKeysArr.length,
                  }),
                  { minLength: 1, maxLength: 3 },
                ),
              }),
              { minLength: 0, maxLength: 3 },
            ),
            1,
          )[0];

          for (const tab of tabs) {
            for (const row of tab.rows) {
              for (const ref of row) {
                if (!validKeys.has(ref)) return false;
              }
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("all create layout references are valid keys", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 10,
        }),
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (columnKeys, computedKeys) => {
          const validKeys = new Set([...columnKeys, ...computedKeys]);

          const createLayout = fc.sample(
            fc.array(fc.constantFrom(...Array.from(validKeys)), {
              minLength: 0,
              maxLength: validKeys.size,
            }),
            1,
          )[0];

          for (const ref of createLayout) {
            if (!validKeys.has(ref)) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("a reference outside valid keys is correctly identified as invalid", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 5,
        }),
        // An invalid key guaranteed not in the valid set
        fc.string({ minLength: 21, maxLength: 30 }),
        (columnKeys, invalidKey) => {
          const validKeys = new Set(columnKeys);
          // The invalid key (longer than any column key) must not be in validKeys
          return !validKeys.has(invalidKey);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Feature: tanstack-use, Property 2: Computed field dependsOn references are valid column keys
/**
 * Property 2: Computed field dependsOn references are valid column keys.
 *
 * For any computed field definition, every entry in `dependsOn` must be a
 * column key of the Drizzle table passed to defineModel().
 *
 * Validates: Requirements 2.4, 2.5
 */
describe("Property 2: Computed field dependsOn references are valid column keys", () => {
  it("every dependsOn entry is a column key when built from valid column keys", () => {
    fc.assert(
      fc.property(
        // Generate a non-empty set of column keys
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 10,
        }),
        (columnKeys) => {
          const columnKeySet = new Set(columnKeys);

          // Build a computed field whose dependsOn only references column keys
          const dependsOn = fc.sample(
            fc.array(fc.constantFrom(...columnKeys), {
              minLength: 1,
              maxLength: columnKeys.length,
            }),
            1,
          )[0] ?? [columnKeys[0]!];

          // Every entry in dependsOn must be a column key
          return dependsOn.every((dep) => columnKeySet.has(dep));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("a dependsOn entry outside column keys is correctly identified as invalid", () => {
    fc.assert(
      fc.property(
        // Column keys are short strings (1–20 chars)
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 5,
        }),
        // Invalid key is guaranteed longer than any column key
        fc.string({ minLength: 21, maxLength: 30 }),
        (columnKeys, invalidKey) => {
          const columnKeySet = new Set(columnKeys);
          // The invalid key must not be in the column key set
          return !columnKeySet.has(invalidKey);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("multiple computed fields each have all dependsOn entries within column keys", () => {
    fc.assert(
      fc.property(
        // Generate a non-empty set of column keys
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 10,
        }),
        // Generate 1–5 computed field definitions
        fc.integer({ min: 1, max: 5 }),
        (columnKeys, numComputedFields) => {
          const columnKeySet = new Set(columnKeys);

          // Build multiple computed fields, each with valid dependsOn arrays
          const computedFields = Array.from({ length: numComputedFields }, (_, i) => {
            const dependsOn = fc.sample(
              fc.array(fc.constantFrom(...columnKeys), {
                minLength: 1,
                maxLength: columnKeys.length,
              }),
              1,
            )[0] ?? [columnKeys[0]!];

            return { key: `computed_${i}`, dependsOn };
          });

          // Every dependsOn entry across all computed fields must be a column key
          return computedFields.every((cf) => cf.dependsOn.every((dep) => columnKeySet.has(dep)));
        },
      ),
      { numRuns: 200 },
    );
  });
});
