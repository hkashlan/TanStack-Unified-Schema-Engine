import { text } from "drizzle-orm/pg-core";
import type { StorageAdapter } from "./storage-adapter.js";

export interface FileModelConfig {
  storage: StorageAdapter;
  fileAccess?: string[]; // Better Auth group names permitted to upload/delete
}

export interface FileModelColumn {
  column: ReturnType<typeof text>;
  _config: FileModelConfig;
}

/**
 * Returns a Drizzle text column (storing the file path) for use in a table.
 * Access control is enforced at upload/delete time via fileAccess groups.
 */
export function fileModel(config: FileModelConfig): FileModelColumn {
  return {
    column: text("file_path"),
    _config: config,
  };
}
