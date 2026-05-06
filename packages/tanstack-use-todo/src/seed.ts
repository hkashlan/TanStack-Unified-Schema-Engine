/**
 * Seed script — creates an initial admin user.
 *
 * Run with:
 *   npx tsx src/seed.ts
 *
 * The user is only created if the email doesn't already exist.
 */
import { auth } from "@tanstack-use/permissions/server";

const EMAIL = "admin@example.com";
const PASSWORD = "password123";
const NAME = "Admin";

const result = await auth.api.signUpEmail({
  body: { email: EMAIL, password: PASSWORD, name: NAME },
});

if (result.error) {
  console.error("Seed failed:", result.error.message);
} else {
  console.log(`✓ User created: ${EMAIL} / ${PASSWORD}`);
}
