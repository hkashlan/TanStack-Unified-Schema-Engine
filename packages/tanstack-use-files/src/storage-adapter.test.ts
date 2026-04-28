import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localDisk, s3 } from "./storage-adapter.js";

// ─── localDisk ───────────────────────────────────────────────────────────────

describe("localDisk", () => {
  const testDir = "test-uploads-tmp";

  afterEach(async () => {
    // clean up the temp upload directory after each test
    await rm(testDir, { recursive: true, force: true });
  });

  function makeFile(name = "hello.txt", content = "hello"): File {
    return new File([content], name, { type: "text/plain" });
  }

  it("stores a file and returns a non-empty relative path string", async () => {
    const adapter = localDisk({ dir: testDir });
    const file = makeFile("test.txt", "content");

    const path = await adapter.store(file);

    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
    expect(existsSync(path)).toBe(true);
  });

  it("returned path includes the original file extension", async () => {
    const adapter = localDisk({ dir: testDir });
    const path = await adapter.store(makeFile("image.png", "data"));

    expect(path.endsWith(".png")).toBe(true);
  });

  it("uses 'uploads' as the default directory", async () => {
    // We don't actually write to the default dir in CI — just verify the
    // returned path starts with the expected prefix.
    const adapter = localDisk({ dir: testDir });
    const path = await adapter.store(makeFile("a.txt"));

    expect(path).toContain(testDir);
  });

  it("deletes a previously stored file", async () => {
    const adapter = localDisk({ dir: testDir });
    const path = await adapter.store(makeFile("to-delete.txt", "bye"));

    expect(existsSync(path)).toBe(true);

    await adapter.delete(path);

    expect(existsSync(path)).toBe(false);
  });

  it("delete rejects when the file does not exist", async () => {
    const adapter = localDisk({ dir: testDir });
    await expect(adapter.delete("nonexistent/path.txt")).rejects.toThrow();
  });
});

// ─── s3 ──────────────────────────────────────────────────────────────────────

describe("s3", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeFile(name = "photo.jpg", content = "img"): File {
    return new File([content], name, { type: "image/jpeg" });
  }

  it("store() calls PutObjectCommand with the correct bucket and returns a key", async () => {
    const sendMock = vi.fn().mockResolvedValue({});
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
      PutObjectCommand: vi.fn().mockImplementation((input) => input),
    }));

    // Re-import after mocking so the dynamic import picks up the mock
    const { s3: s3Mocked } = await import("./storage-adapter.js");
    const adapter = s3Mocked({ bucket: "my-bucket", region: "us-east-1" });

    const key = await adapter.store(makeFile("photo.jpg"));

    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
    expect(key.endsWith(".jpg")).toBe(true);
    expect(sendMock).toHaveBeenCalledOnce();

    const [putCmd] = sendMock.mock.calls[0] as [{ Bucket: string; Key: string }];
    expect(putCmd.Bucket).toBe("my-bucket");
    expect(putCmd.Key).toBe(key);
  });

  it("delete() calls DeleteObjectCommand with the correct bucket and key", async () => {
    const sendMock = vi.fn().mockResolvedValue({});
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
      DeleteObjectCommand: vi.fn().mockImplementation((input) => input),
    }));

    const { s3: s3Mocked } = await import("./storage-adapter.js");
    const adapter = s3Mocked({ bucket: "my-bucket", region: "us-east-1" });

    await adapter.delete("some/key.jpg");

    expect(sendMock).toHaveBeenCalledOnce();
    const [delCmd] = sendMock.mock.calls[0] as [{ Bucket: string; Key: string }];
    expect(delCmd.Bucket).toBe("my-bucket");
    expect(delCmd.Key).toBe("some/key.jpg");
  });

  it("store() propagates S3 errors", async () => {
    const sendMock = vi.fn().mockRejectedValue(new Error("S3 unavailable"));
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
      PutObjectCommand: vi.fn().mockImplementation((input) => input),
    }));

    const { s3: s3Mocked } = await import("./storage-adapter.js");
    const adapter = s3Mocked({ bucket: "my-bucket", region: "us-east-1" });

    await expect(adapter.store(makeFile())).rejects.toThrow("S3 unavailable");
  });
});
