/**
 * Server-only entry point for @tanstack-use/permissions.
 *
 * Import from "@tanstack-use/permissions/server" inside "use server" files only.
 * Never import this from client components — it pulls in drizzle-orm and pg.
 */
export * from "./create-auth-route.js";
