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
 * **Session caching**: The session is fetched once via `queryClient.ensureQueryData()`
 * so the result is stored in the React Query cache. Components that call
 * `useSession()` (or `useQuery` with the same key) will read from the cache
 * instead of making a second network request.
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
import type { QueryClient } from "@tanstack/react-query";
import { appClient, type SessionClient } from "@tanstack-use/core/client";

export interface AuthBeforeLoadOptions {
  /**
   * Async function that resolves the current session.
   *
   * Supports two shapes:
   *  - better-auth: `{ data: { user, session } | null, error }`
   *  - plain:       `{ user: ... } | null | undefined`
   *
   * The return type flows through to `{ session }` in the route context,
   * so callers get full type safety without any `unknown` casts.
   */
  // getSession: () => Promise<SessionClient>;

  /**
   * The path to redirect unauthenticated users to.
   * @default "/login"
   */
  loginPath?: string;

  /**
   * The React Query cache key used to store the session.
   *
   * Must match the key used by `useSession()` in your auth client so that
   * components read from the cache instead of making a second network request.
   *
   * Better Auth's `useSession()` uses `["session"]` by default.
   * @default ["session"]
   */
  sessionQueryKey?: readonly unknown[];

  /**
   * How long (in ms) the cached session is considered fresh.
   * After this time, `useSession()` will refetch in the background.
   * @default 300_000 (5 minutes)
   */
  sessionStaleTime?: number;
}

/**
 * Returns a TanStack Router `beforeLoad` callback that:
 *  1. Fetches the session once via `queryClient.ensureQueryData()` to seed
 *     the React Query cache — `useSession()` in components reads from cache
 *     instead of making a second `/api/auth/get-session` request.
 *  2. Redirects unauthenticated users to `loginPath`.
 *  3. Returns `{ session: TSession }` so child routes can access it via route
 *     context with full type safety — no `unknown` casts needed.
 *
 * Handles both the better-auth `{ data: { user } }` response shape and plain
 * `{ user }` shapes so it works with any auth client.
 *
 * The check is skipped during SSR — it only runs in the browser where the
 * auth client can reliably read the session cookie.
 *
 * Place this on a pathless layout route (e.g. `_authenticated`) and nest all
 * protected routes under it.
 *
 * @example
 * ```ts
 * beforeLoad: createAuthBeforeLoad({
 *   getSession: () => appClient.auth.getSession(),
 *   loginPath: "/demo/better-auth",
 * }),
 * // Route context is now typed as { session: Awaited<ReturnType<typeof appClient.auth.getSession>> }
 * ```
 */
export function createAuthBeforeLoad({
  // getSession,
  loginPath = "/login",
  sessionQueryKey = ["session"],
  sessionStaleTime = 5 * 60 * 1000,
}: AuthBeforeLoadOptions) {
  return async function beforeLoad({
    location,
    context,
  }: {
    location: { href: string };
    context: { queryClient?: QueryClient };
  }): Promise<{ session: SessionClient }> {
    // Skip the session check on the server. Auth clients (e.g. better-auth)
    // rely on browser cookies and cannot reliably resolve a session during SSR.
    // The check runs on the client after hydration, which is sufficient for
    // protecting routes without causing false redirects.
    // We cast the early return so TanStack Router sees a single non-union
    // context type — no component ever renders during SSR, so the placeholder
    // value is never actually used.
    if (typeof window === "undefined") {
      return {} as { session: SessionClient };
    }

    // Use ensureQueryData when a queryClient is available — this stores the
    // session in the React Query cache so useSession() reads from cache
    // instead of making a second /api/auth/get-session request.
    let result: SessionClient;
     const   getSession = async (): Promise<SessionClient> => {
      const { data } = await appClient.auth.getSession();
      return data as SessionClient; // Cast to ensure it matches TanStack's expected shape
    }
    if (context.queryClient) {
      result = await context.queryClient.ensureQueryData({
        queryKey: sessionQueryKey as unknown[],
        queryFn: getSession,
        staleTime: sessionStaleTime,
      });
    } else {
      result = await getSession();
    }

    // Resolve the user from either shape:
    //   better-auth: { data: { user, session } | null, error }
    //   plain:       { user } | null | undefined
    const user =result?.user;

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
    // TSession is inferred from getSession's return type, so consumers get
    // full autocomplete without any `unknown` casts.
    return { session: result };
  };
}
