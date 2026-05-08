/**
 * Creates a `BetterAuthInstance`-compatible adapter backed by the
 * `tanstack_use_roles` and `tanstack_use_user_roles` tables.
 *
 * `getActiveMemberGroups` joins `user_roles → roles` and returns the role
 * names for the current session's user. These names are matched against the
 * `permissions` defined on each model:
 *   `permissions: { delete: ["admin"], create: ["admin", "editor"] }`
 */

import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { rolesTable, userRolesTable } from "./schema/schema.js";

/**
 * Minimal structural interface for the Better Auth instance.
 * The framework only calls `auth.api.getActiveMemberGroups(session)` at
 * runtime — the full BetterAuth generic type is not needed here.
 */
export interface BetterAuthInstance {
  api: {
    getActiveMemberGroups: (session: unknown) => Promise<string[]>;
  };
}

/**
 * Returns a `BetterAuthInstance` that resolves role names from the DB.
 *
 * The session shape is compatible with better-auth:
 *   `{ user: { id: string } }`
 */
export function createPermissionsAdapter(db: PgDatabase<PgQueryResultHKT>): BetterAuthInstance {
  return {
    api: {
      getActiveMemberGroups: async (session: unknown): Promise<string[]> => {
        const userId = (session as { user?: { id?: string } } | null)?.user?.id;
        if (!userId) return [];

        const rows = await db
          .select({ name: rolesTable.name })
          .from(userRolesTable)
          .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
          .where(eq(userRolesTable.userId, userId));

        return rows.map((r) => r.name);
      },
    },
  };
}
