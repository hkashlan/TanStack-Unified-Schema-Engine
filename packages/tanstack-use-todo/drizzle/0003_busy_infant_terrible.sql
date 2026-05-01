CREATE TABLE "tanstack_use_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tanstack_use_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tanstack_use_user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" serial NOT NULL,
	CONSTRAINT "tanstack_use_user_roles_user_id_role_id_unique" UNIQUE("user_id","role_id")
);
