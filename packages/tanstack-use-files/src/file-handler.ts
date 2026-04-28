import { AuthorizationError } from "@tanstack-use/permissions";
import type { App } from "@tanstack-use/core";
import type { FileModelColumn } from "./file-model.js";

export interface UploadRequest {
  session: unknown;
  fileModelColumn: FileModelColumn;
  file: File;
}

export interface DeleteRequest {
  session: unknown;
  fileModelColumn: FileModelColumn;
  path: string;
}

/**
 * Checks fileAccess groups and stores the file via the configured adapter.
 * Throws AuthorizationError (HTTP 403) if the member lacks upload permission.
 * Returns the stored file path.
 */
export async function handleUpload(req: UploadRequest, app: App): Promise<string> {
  const allowedGroups = req.fileModelColumn._config.fileAccess ?? [];

  if (allowedGroups.length > 0) {
    const memberGroups = await app.auth.api.getActiveMemberGroups(req.session);
    if (!memberGroups.some((g) => allowedGroups.includes(g))) {
      throw new AuthorizationError("Upload not permitted");
    }
  }

  return req.fileModelColumn._config.storage.store(req.file);
}

/**
 * Checks fileAccess groups and deletes the file via the configured adapter.
 * Throws AuthorizationError (HTTP 403) if the member lacks delete permission.
 */
export async function handleDelete(req: DeleteRequest, app: App): Promise<void> {
  const allowedGroups = req.fileModelColumn._config.fileAccess ?? [];

  if (allowedGroups.length > 0) {
    const memberGroups = await app.auth.api.getActiveMemberGroups(req.session);
    if (!memberGroups.some((g) => allowedGroups.includes(g))) {
      throw new AuthorizationError("Delete not permitted");
    }
  }

  await req.fileModelColumn._config.storage.delete(req.path);
}
