/**
 * Seed script — creates an initial admin user.
 *
 * Run with:
 *   npx tsx src/seed.ts
 *
 * The user is only created if the email doesn't already exist.
 */

import { appServer } from "@tanstack-use/core/server";

const auth = appServer.auth;

const EMAIL = "admin@example.com";
const PASSWORD = "password123";
const NAME = "Admin";

 await auth.api.signUpEmail({
  body: { email: EMAIL, password: PASSWORD, name: NAME },
});

  console.log(`✓ User created: ${EMAIL} / ${PASSWORD}`);
