import { execSync } from "child_process";

const command = process.argv[2];
if (!command) {
  console.error("Usage: tsx scripts/drizzle.ts <migrate|generate|studio>");
  process.exit(1);
}

// Use the locally installed drizzle-kit to avoid version mismatch with drizzle-orm
execSync(`node_modules/.bin/drizzle-kit ${command}`, { stdio: "inherit" });
