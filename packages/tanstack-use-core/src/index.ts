// tanstack-use-core public API
// Safe to import on client and server.

export { appClient, getModel } from "./client.js";
export type { AppConfig } from "./define-app.js";
export { defineApp } from "./define-app.js";
export { defineModel } from "./define-model.js";
export { executeCreate, executeUpdate } from "./execute-hooks.js";
export { buildAc, generatePermissions } from "./permission-generator.js";

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
  RegisteredApp,
  ServerHooks,
  TabDef,
  UIConfig,
  UIFieldDef,
} from "./types.js";
