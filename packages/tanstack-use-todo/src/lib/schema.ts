import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
export { rolesTable, userRolesTable } from "@tanstack-use/permissions/server";

export const todosTable = pgTable("todos", {
  id:        serial("id").primaryKey(),
  title:     text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  userId:    text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
