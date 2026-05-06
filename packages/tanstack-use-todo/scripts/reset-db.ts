/**
 * Reset script — drops all tables, re-runs migrations, and re-seeds.
 *
 * Run with:
 *   npm run db:reset   (from packages/tanstack-use-todo)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { execSync } from "node:child_process";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set");
  process.exit(1);
}

const db = drizzle({ connection: DATABASE_URL });

// Drop in reverse-dependency order so FK constraints don't block us.
const tables = [
  "todos",
  "user_roles",
  "roles",
  "session",
  "account",
  "verification",
  "user",
];

console.log("🗑️  Dropping tables…");
for (const table of tables) {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`));
  console.log(`   dropped: ${table}`);
}

// Also drop the drizzle migrations tracking table so it re-applies cleanly.
await db.execute(sql.raw(`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`));
console.log("   dropped: __drizzle_migrations");

console.log("\n📦  Running migrations…");
execSync("npx drizzle-kit migrate", { stdio: "inherit" });

console.log("\n🌱  Seeding…");
execSync("npm run seed", { stdio: "inherit" });

console.log("\n✅  Database reset complete.");
