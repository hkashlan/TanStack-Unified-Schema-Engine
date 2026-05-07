// tanstack-use-core entry point

export type { AppConfig } from "./define-app.js";
export { defineApp } from "./define-app.js";
export { defineModel } from "./define-model.js";
export { executeCreate, executeUpdate } from "./execute-hooks.js";

export type {
  AllFieldKeys,
  App,
  BetterAuthSession,
  ClientHooks,
  ComputedFieldDef,
  InferRecord,
  LayoutDef,
  ListOptions,
  Model,
  PermissionsDef,
  ServerHooks,
  TabDef,
  UIConfig,
  UIFieldDef,
} from "./types.js";

// NOTE: createDb is intentionally NOT exported here — it imports
// drizzle-orm/node-postgres (which pulls in pg) and must only be imported
// in server-only files. Import directly from "@tanstack-use/core/src/db.js".