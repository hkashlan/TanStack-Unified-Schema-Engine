import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export * from "@tanstack-use/core/schema";

export const todosTable = pgTable("todos", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	completed: boolean("completed").notNull().default(false),
	userId: text("user_id").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
