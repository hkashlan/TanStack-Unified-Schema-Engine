/**
 * Feature: tanstack-use, Property 5: File upload access is consistent with fileAccess config
 *
 * For any fileModel() config and any member group list, upload (and delete) is
 * permitted if and only if fileAccess is empty OR the member's groups intersect
 * fileAccess.
 *
 * Validates: Requirements 6.3, 6.4
 */

import { AuthorizationError } from "@tanstack-use/permissions";
import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { handleDelete, handleUpload } from "./file-handler.js";
import { fileModel } from "./file-model.js";
import type { StorageAdapter } from "./storage-adapter.js";

function makeStorageAdapter(): StorageAdapter {
  return {
    store: vi.fn().mockResolvedValue("uploads/file.txt"),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeApp(memberGroups: string[]) {
  return {
    _tag: "App" as const,
    models: new Map(),
    auth: {
      api: {
        getActiveMemberGroups: vi.fn().mockResolvedValue(memberGroups),
      },
    },
  };
}

function makeFile(): File {
  return new File(["data"], "test.txt", { type: "text/plain" });
}

/** Expected permission: open when fileAccess empty, else intersection must be non-empty */
function isPermitted(fileAccess: string[], memberGroups: string[]): boolean {
  return fileAccess.length === 0 || memberGroups.some((g) => fileAccess.includes(g));
}

describe("Property 5: File upload access is consistent with fileAccess config", () => {
  it("handleUpload result matches set-intersection logic for all group combinations", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
        async (fileAccess, memberGroups) => {
          const storage = makeStorageAdapter();
          const fmc = fileModel({ storage, fileAccess });
          const app = makeApp(memberGroups);

          const permitted = isPermitted(fileAccess, memberGroups);

          if (permitted) {
            const path = await handleUpload(
              { session: {}, fileModelColumn: fmc, file: makeFile() },
              app,
            );
            expect(typeof path).toBe("string");
          } else {
            await expect(
              handleUpload({ session: {}, fileModelColumn: fmc, file: makeFile() }, app),
            ).rejects.toThrow(AuthorizationError);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("handleDelete result matches set-intersection logic for all group combinations", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
        async (fileAccess, memberGroups) => {
          const storage = makeStorageAdapter();
          const fmc = fileModel({ storage, fileAccess });
          const app = makeApp(memberGroups);

          const permitted = isPermitted(fileAccess, memberGroups);

          if (permitted) {
            await expect(
              handleDelete({ session: {}, fileModelColumn: fmc, path: "uploads/x.txt" }, app),
            ).resolves.toBeUndefined();
          } else {
            await expect(
              handleDelete({ session: {}, fileModelColumn: fmc, path: "uploads/x.txt" }, app),
            ).rejects.toThrow(AuthorizationError);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
