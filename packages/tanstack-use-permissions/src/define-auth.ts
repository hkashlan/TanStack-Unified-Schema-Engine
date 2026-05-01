import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

/**
 * Wraps Better Auth initialization to enforce the presence of the organization plugin.
 * The tanstack-use framework relies on group-based permissions via this plugin.
 */
export function defineAuth(options: Parameters<typeof betterAuth>[0]) {
  return betterAuth({
    ...options,
    plugins: [organization(), tanstackStartCookies(), ...(options.plugins || [])],
  });
}
