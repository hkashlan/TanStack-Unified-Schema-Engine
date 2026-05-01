/**
 * Auth guard utilities for TanStack Router.
 *
 * `createAuthBeforeLoad` produces a `beforeLoad` callback that redirects
 * unauthenticated users to a configurable login path. Wire it into a TanStack
 * Router layout route that wraps all protected routes.
 *
 * @example
 * ```ts
 * // src/routes/_authenticated.tsx
 * import { createFileRoute, Outlet } from "@tanstack/react-router";
 * import { createAuthBeforeLoad } from "@tanstack-use/ui";
 * import { authClient } from "#/lib/auth-client";
 *
 * export const Route = createFileRoute("/_authenticated")({
 *   beforeLoad: createAuthBeforeLoad({
 *     getSession: () => authClient.getSession(),
 *     loginPath: "/demo/better-auth",
 *   }),
 *   component: () => <Outlet />,
 * });
 * ```
 */

import { redirect } from "@tanstack/react-router";

export interface AuthBeforeLoadOptions {
  /**
   * Async function that resolves the current session.
   *
   * Supports two shapes:
   *  - better-auth: `{ data: { user, session } | null, error }`
   *  - plain:       `{ user: ... } | null | undefined`
   */
  getSession: () => Promise<unknown>;

  /**
   * The path to redirect unauthenticated users to.
   * @default "/login"
   */
  loginPath?: string;
}

/**
 * Returns a TanStack Router `beforeLoad` callback that redirects
 * unauthenticated users to `loginPath`.
 *
 * Handles both the better-auth `{ data: { user } }` response shape and plain
 * `{ user }` shapes so it works with any auth client.
 *
 * Place this on a pathless layout route (e.g. `_authenticated`) and nest all
 * protected routes under it.
 */
export function createAuthBeforeLoad({
  getSession,
  loginPath = "/login",
}: AuthBeforeLoadOptions) {
  return async function beforeLoad({
    location,
  }: {
    location: { href: string };
  }) {
    const result = await getSession();

    // Resolve the user from either shape:
    //   better-auth: { data: { user, session } | null, error }
    //   plain:       { user } | null | undefined
    const betterAuthUser = (result as { data?: { user?: unknown } | null } | null)?.data?.user;
    const plainUser = (result as { user?: unknown } | null)?.user;
    const user = betterAuthUser ?? plainUser;

    if (!user) {
      throw redirect({
        to: loginPath,
        search: {
          // Preserve the intended destination so the login page can redirect
          // back after a successful sign-in.
          redirect: location.href,
        },
      });
    }

    // Return the session so child routes can access it via route context.
    return { session: result };
  };
}
