/**
 * Drizzle schema for the tanstack-use permissions system.
 *
 * Import these tables into your application's schema file so that
 * `drizzle-kit generate` picks them up and creates the migrations.
 *
 * @example
 * ```ts
 * // src/lib/schema.ts
 * export { rolesTable, userRolesTable } from "@tanstack-use/permissions";
 * export const todosTable = pgTable("todos", { ... });
 * ```
 *
 * Tables:
 *  - `roles`      — role names created by end-users at runtime (e.g. "admin", "editor")
 *  - `user_roles` — many-to-many join between users and roles
 */

import { pgTable, serial, text, unique } from "drizzle-orm/pg-core";

/**
 * Roles table — end-users create and name roles at runtime.
 * The `name` is what developers reference in `defineModel`:
 *   `permissions: { delete: ["admin"] }`
 */
export const rolesTable = pgTable("tanstack_use_roles", {
  id:   serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

/**
 * User-to-role assignments — a user can have multiple roles.
 * `userId` matches the `id` from your auth provider's user table.
 */
export const userRolesTable = pgTable(
  "tanstack_use_user_roles",
  {
    id:     serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    roleId: serial("role_id").notNull(),
  },
  (t) => [unique().on(t.userId, t.roleId)],
);
