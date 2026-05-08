/**
 * Auth guard utilities for TanStack Router.
 *
 * `createAuthBeforeLoad` produces a `beforeLoad` callback that redirects
 * unauthenticated users to a configurable login path. Wire it into a TanStack
 * Router layout route that wraps all protected routes.
 *
 * The session check is skipped on the server (SSR pass) and only runs in the
 * browser, avoiding issues with auth clients that rely on cookies/fetch and
 * cannot resolve a session during server-side rendering.
 *
 * @example
 * ```ts
 * // src/routes/_authenticated.tsx
 * import { createFileRoute, Outlet } from "@tanstack/react-router";
 * import { createAuthBeforeLoad } from "@tanstack-use/ui";
 * import { appClient } from "@tanstack-use/core/client";
 *
 * export const Route = createFileRoute("/_authenticated")({
 *   beforeLoad: createAuthBeforeLoad({
 *     getSession: () => appClient.auth.getSession(),
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
 * The check is skipped during SSR — it only runs in the browser where the
 * auth client can reliably read the session cookie.
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
    // Skip the session check on the server. Auth clients (e.g. better-auth)
    // rely on browser cookies and cannot reliably resolve a session during SSR.
    // The check runs on the client after hydration, which is sufficient for
    // protecting routes without causing false redirects.
    if (typeof window === "undefined") {
      return;
    }

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
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          // Preserve the intended destination so the login page can redirect
          // back after a successful sign-in. Strip the origin so the value is
          // always a relative path (e.g. /todos/) regardless of environment.
          redirect: location.href.replace(/^https?:\/\/[^/]+/, ""),
        }),
      });
    }

    // Return the session so child routes can access it via route context.
    return { session: result };
  };
}
