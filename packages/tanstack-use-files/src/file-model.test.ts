import { AuthorizationError } from "@tanstack-use/permissions";
import { describe, expect, it, vi } from "vitest";
import { handleDelete, handleUpload } from "./file-handler.js";
import { fileModel } from "./file-model.js";
import type { StorageAdapter } from "./storage-adapter.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStorageAdapter(storedPath = "uploads/file.txt"): StorageAdapter {
  return {
    store: vi.fn().mockResolvedValue(storedPath),
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

function makeFile(name = "test.txt"): File {
  return new File(["content"], name, { type: "text/plain" });
}

// ─── fileModel() ─────────────────────────────────────────────────────────────

describe("fileModel()", () => {
  it("returns an object with a column and _config", () => {
    const storage = makeStorageAdapter();
    const result = fileModel({ storage, fileAccess: ["admin"] });

    expect(result).toHaveProperty("column");
    expect(result).toHaveProperty("_config");
  });

  it("stores the provided config on _config", () => {
    const storage = makeStorageAdapter();
    const config = { storage, fileAccess: ["admin", "hr"] };
    const result = fileModel(config);

    expect(result._config).toBe(config);
  });

  it("works without fileAccess (open access)", () => {
    const storage = makeStorageAdapter();
    const result = fileModel({ storage });

    expect(result._config.fileAccess).toBeUndefined();
  });
});

// ─── handleUpload() ──────────────────────────────────────────────────────────

describe("handleUpload()", () => {
  it("returns the stored path when member groups intersect fileAccess", async () => {
    const storage = makeStorageAdapter("uploads/photo.jpg");
    const fmc = fileModel({ storage, fileAccess: ["admin"] });
    const app = makeApp(["admin"]);

    const path = await handleUpload({ session: {}, fileModelColumn: fmc, file: makeFile() }, app);

    expect(path).toBe("uploads/photo.jpg");
    expect(storage.store).toHaveBeenCalledOnce();
  });

  it("throws AuthorizationError when member groups don't intersect fileAccess", async () => {
    const storage = makeStorageAdapter();
    const fmc = fileModel({ storage, fileAccess: ["admin"] });
    const app = makeApp(["viewer"]);

    await expect(
      handleUpload({ session: {}, fileModelColumn: fmc, file: makeFile() }, app),
    ).rejects.toThrow(AuthorizationError);

    expect(storage.store).not.toHaveBeenCalled();
  });

  it("allows upload when fileAccess is empty (open access)", async () => {
    const storage = makeStorageAdapter("uploads/open.txt");
    const fmc = fileModel({ storage, fileAccess: [] });
    const app = makeApp([]);

    const path = await handleUpload({ session: {}, fileModelColumn: fmc, file: makeFile() }, app);

    expect(path).toBe("uploads/open.txt");
  });

  it("allows upload when fileAccess is absent", async () => {
    const storage = makeStorageAdapter("uploads/open.txt");
    const fmc = fileModel({ storage });
    const app = makeApp([]);

    const path = await handleUpload({ session: {}, fileModelColumn: fmc, file: makeFile() }, app);

    expect(path).toBe("uploads/open.txt");
  });

  it("throws AuthorizationError with status 403", async () => {
    const storage = makeStorageAdapter();
    const fmc = fileModel({ storage, fileAccess: ["admin"] });
    const app = makeApp(["user"]);

    const err = await handleUpload(
      { session: {}, fileModelColumn: fmc, file: makeFile() },
      app,
    ).catch((e) => e);

    expect(err).toBeInstanceOf(AuthorizationError);
    expect(err.status).toBe(403);
  });
});

// ─── handleDelete() ──────────────────────────────────────────────────────────

describe("handleDelete()", () => {
  it("calls storage.delete when member groups intersect fileAccess", async () => {
    const storage = makeStorageAdapter();
    const fmc = fileModel({ storage, fileAccess: ["admin"] });
    const app = makeApp(["admin"]);

    await handleDelete({ session: {}, fileModelColumn: fmc, path: "uploads/old.txt" }, app);

    expect(storage.delete).toHaveBeenCalledWith("uploads/old.txt");
  });

  it("throws AuthorizationError when member groups don't intersect fileAccess", async () => {
    const storage = makeStorageAdapter();
    const fmc = fileModel({ storage, fileAccess: ["admin"] });
    const app = makeApp(["viewer"]);

    await expect(
      handleDelete({ session: {}, fileModelColumn: fmc, path: "uploads/old.txt" }, app),
    ).rejects.toThrow(AuthorizationError);

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("allows delete when fileAccess is empty (open access)", async () => {
    const storage = makeStorageAdapter();
    const fmc = fileModel({ storage, fileAccess: [] });
    const app = makeApp([]);

    await handleDelete({ session: {}, fileModelColumn: fmc, path: "uploads/file.txt" }, app);

    expect(storage.delete).toHaveBeenCalledWith("uploads/file.txt");
  });

  it("allows delete when fileAccess is absent", async () => {
    const storage = makeStorageAdapter();
    const fmc = fileModel({ storage });
    const app = makeApp([]);

    await handleDelete({ session: {}, fileModelColumn: fmc, path: "uploads/file.txt" }, app);

    expect(storage.delete).toHaveBeenCalledWith("uploads/file.txt");
  });
});
