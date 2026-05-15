/**
 * Seed script — creates an initial admin user with an organization.
 *
 * Run with:
 *   pnpm --filter @tanstack-use/todo seed
 *
 * Safe to re-run: skips creation if the email already exists.
 */

import { appServer } from "@tanstack-use/core/server";
import { organization, member, user, organizationRole } from "@tanstack-use/core/server";
import { and, eq } from "drizzle-orm";

console.log("DATABASE_URL: ", process.env["DATABASE_URL"]);

const auth = appServer.auth;
const db = appServer.db;

const EMAIL = "admin@example.com";
const PASSWORD = "password123";
const NAME = "Admin";
const ORG_NAME = "Default";
const ORG_SLUG = "default";

// All models and their CRUD actions that the owner role should have full access to.
const OWNER_PERMISSIONS: Record<string, string[]> = {
  todo: ["create", "read", "update", "delete"],
};

// ---------------------------------------------------------------------------
// 1. Create the user (skip if already exists)
// ---------------------------------------------------------------------------
const existingUsers = await db.select().from(user).where(eq(user.email, EMAIL));
let userId: string;

if (existingUsers.length > 0) {
  console.log(`→ User already exists: ${EMAIL}`);
  userId = existingUsers[0]!.id;
} else {
  // Use Better Auth's API to create the user so the password is hashed correctly
  const signUpResult = await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: NAME },
  });
  userId = signUpResult.user.id;
  console.log(`✓ User created: ${EMAIL} / ${PASSWORD}`);
}

// ---------------------------------------------------------------------------
// 2. Create the organization (skip if already exists)
// ---------------------------------------------------------------------------
const existingOrgs = await db
  .select()
  .from(organization)
  .where(eq(organization.slug, ORG_SLUG));

let orgId: string;

if (existingOrgs.length > 0) {
  console.log(`→ Organization already exists: ${ORG_NAME}`);
  orgId = existingOrgs[0]!.id;
} else {
  const [newOrg] = await db
    .insert(organization)
    .values({
      id: crypto.randomUUID(),
      name: ORG_NAME,
      slug: ORG_SLUG,
      createdAt: new Date(),
    })
    .returning();
  orgId = newOrg!.id;
  console.log(`✓ Organization created: ${ORG_NAME}`);
}

// ---------------------------------------------------------------------------
// 3. Add user as owner of the organization (skip if already a member)
// ---------------------------------------------------------------------------
const existingMembers = await db
  .select()
  .from(member)
  .where(eq(member.userId, userId));

if (existingMembers.length > 0) {
  console.log(`→ User is already a member of an organization`);
} else {
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });
  console.log(`✓ User added as owner of: ${ORG_NAME}`);
}

// ---------------------------------------------------------------------------
// 4. Grant the owner role full CRUD permissions on all models
//
// Better Auth's organization plugin stores permissions in `organizationRole`
// with one row per (organizationId, role, resource). The `permission` column
// must be a JSON string in the shape: {"<resource>":["create","read",...]}
// ---------------------------------------------------------------------------
for (const [resource, actions] of Object.entries(OWNER_PERMISSIONS)) {
  const permissionJson = JSON.stringify({ [resource]: actions });

  const existing = await db
    .select()
    .from(organizationRole)
    .where(
      and(
        eq(organizationRole.organizationId, orgId),
        eq(organizationRole.role, "owner"),
        eq(organizationRole.permission, permissionJson),
      ),
    );

  if (existing.length > 0) {
    console.log(`→ Permission already exists: owner → ${resource}: [${actions.join(", ")}]`);
  } else {
    await db.insert(organizationRole).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      role: "owner",
      permission: permissionJson,
      createdAt: new Date(),
    });
    console.log(`✓ Permission granted: owner → ${resource}: [${actions.join(", ")}]`);
  }
}

console.log(`\nDone! Login with: ${EMAIL} / ${PASSWORD}`);
