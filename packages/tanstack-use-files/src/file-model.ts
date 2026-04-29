import { text } from "drizzle-orm/pg-core";
import type { StorageAdapter } from "./storage-adapter.js";

export interface FileModelConfig {
  storage: StorageAdapter;
  fileAccess?: string[]; // Better Auth group names permitted to upload/delete
}

export interface FileModelColumn {
  column: ReturnType<typeof text> & { _config: FileModelConfig };
  _config: FileModelConfig;
}

/**
 * Returns a Drizzle text column (storing the file path) for use in a table.
 * Access control is enforced at upload/delete time via fileAccess groups.
 *
 * The `_config` property is attached directly to the column object so that
 * the UI layer can detect file fields by checking for `_config` presence on
 * the column (Requirements 6.6, 6.7).
 */
export function fileModel(config: FileModelConfig): FileModelColumn {
  const column = text("file_path") as ReturnType<typeof text> & {
    _config: FileModelConfig;
  };
  // Attach _config to the column so the UI can detect file fields
  column._config = config;
  return {
    column,
    _config: config,
  };
}
