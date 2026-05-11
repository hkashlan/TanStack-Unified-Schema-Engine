/**
 * Reset script — drops all tables, re-runs migrations, and re-seeds.
 *
 * Run with:
 *   pnpm db:reset   (from packages/tanstack-use-todo)
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

// Fetch all user tables in the public schema dynamically.
const result = await db.execute<{ tablename: string }>(
  sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
);

const tables = result.rows.map((r) => r.tablename);

console.log("🗑️  Dropping tables…");
for (const table of tables) {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`));
  console.log(`   dropped: ${table}`);
}

console.log("\n📦  Running generate");
execSync("pnpm db:generate", { stdio: "inherit" });

console.log("\n📦  Running migrations…");
execSync("pnpm db:migrate", { stdio: "inherit" });

console.log("\n🌱  Seeding…");
execSync("pnpm run seed", { stdio: "inherit" });

console.log("\n✅  Database reset complete.");
