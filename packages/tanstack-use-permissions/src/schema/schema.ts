/**
 * Drizzle schema for the tanstack-use permissions system.
 *
 * Import these tables into your application's schema file so that
 * `drizzle-kit generate` picks them up and creates the migrations.
 *
 * @example
 * ```ts
 * // src/lib/schema.ts
 * export { rolesTable, userRolesTable, usersTable } from "@tanstack-use/permissions/server";
 * export const todosTable = pgTable("todos", { ... });
 * ```
 *
 * Tables:
 *  - `user`       — mirrors Better Auth's own user table (for FK references and joins)
 *  - `roles`      — role names created by end-users at runtime (e.g. "admin", "editor")
 *  - `user_roles` — many-to-many join between users and roles
 */

import {
  integer,
  pgTable,
  serial,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";
export * from "./auth-schema.js";

/**
 * Alias for Better Auth's `user` table — exported as `usersTable` for
 * consistency with the rest of the permissions schema API.
 */
export { user as usersTable };



/**
 * Roles table — end-users create and name roles at runtime.
 * The `name` is what developers reference in `defineModel`:
 *   `permissions: { delete: ["admin"] }`
 */
export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

/**
 * User-to-role assignments — a user can have multiple roles.
 * `userId` references the `id` from the `user` table (Better Auth).
 * `roleId` references the `id` from the `roles` table.
 */
export const userRolesTable = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id),
    roleId: integer("role_id").notNull().references(() => rolesTable.id),
  },
  (t) => [unique().on(t.userId, t.roleId)],
);
