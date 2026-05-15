/**
 * defineAuth — wraps `betterAuth` with the organization and
 * tanstackStartCookies plugins always applied.
 *
 * This is the permissions-package entry point for creating a Better Auth
 * instance. It ensures the required plugins are always present regardless
 * of what extra options the caller provides.
 */

import { type BetterAuthOptions, betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

/**
 * Creates a Better Auth instance with the organization and
 * tanstackStartCookies plugins always included.
 *
 * @param options - Standard Better Auth options (must include `database`)
 */
// The return type of betterAuth() references internal zod types that cannot
// be named portably (TS2742). We use `unknown` as the return type and cast
// at the call site to keep the public API stable.
export function defineAuth(options: BetterAuthOptions): ReturnType<typeof betterAuth> {
  return betterAuth({
    ...options,
    plugins: [organization(), tanstackStartCookies(), ...(options.plugins ?? [])],
  });
}
