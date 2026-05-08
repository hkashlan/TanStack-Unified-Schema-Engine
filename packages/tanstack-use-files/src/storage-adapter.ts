import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { randomUUID } from "node:crypto";

/** Core storage contract — store a file, delete by path */
export interface StorageAdapter {
  store(file: File): Promise<string>;
  delete(path: string): Promise<void>;
}

/**
 * Dynamic import helper for optional peer dependencies.
 * Using a function wrapper avoids TypeScript's static module resolution
 * for packages that are not installed at type-check time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dynamicImport(specifier: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function("s", "return import(s)")(specifier) as Promise<unknown>;
}

/**
 * Local filesystem adapter.
 * Writes files to `dir` (default: "uploads") and returns a relative path.
 */
export function localDisk(options?: { dir?: string }): StorageAdapter {
  const dir = options?.dir ?? "uploads";

  return {
    async store(file: File): Promise<string> {
      await mkdir(dir, { recursive: true });
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const filename = ext ? `${randomUUID()}.${ext}` : randomUUID();
      const fullPath = join(dir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(fullPath, buffer);
      return relative(process.cwd(), fullPath);
    },

    async delete(path: string): Promise<void> {
      await unlink(path);
    },
  };
}

/**
 * AWS S3 adapter.
 * Uploads to the given bucket and returns the S3 object key.
 * Requires `@aws-sdk/client-s3` to be installed in the consuming project.
 */
export function s3(options: { bucket: string; region: string }): StorageAdapter {
  const { bucket, region } = options;

  return {
    async store(file: File): Promise<string> {
      const { S3Client, PutObjectCommand } = await dynamicImport("@aws-sdk/client-s3");
      const client = new S3Client({ region });
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const key = ext ? `${randomUUID()}.${ext}` : randomUUID();
      const buffer = Buffer.from(await file.arrayBuffer());
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer }),
      );
      return key;
    },

    async delete(path: string): Promise<void> {
      const { S3Client, DeleteObjectCommand } = await dynamicImport("@aws-sdk/client-s3");
      const client = new S3Client({ region });
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: path }),
      );
    },
  };
}
