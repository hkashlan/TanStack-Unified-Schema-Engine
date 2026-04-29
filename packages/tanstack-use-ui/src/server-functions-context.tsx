/**
 * React context provider and hook for TanStack Start server functions.
 *
 * Usage:
 *   1. Call `createServerFunctions(app, db)` once at the application root.
 *   2. Wrap the app with `<ServerFunctionsProvider fns={fns}>`.
 *   3. In any generated page component, call `useServerFunctions()` to get
 *      the typed server functions.
 *
 * Requirements: 14.6, 14.7, 14.8
 */

import React, { createContext, useContext } from "react";
import type { ServerFunctions } from "./server-functions.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Internal React context. Null when no provider is present.
 * Consumers should always use `useServerFunctions()` rather than reading
 * this context directly.
 */
export const ServerFunctionsContext = createContext<ServerFunctions | null>(
  null,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ServerFunctionsProviderProps {
  /** The server functions object returned by `createServerFunctions(app, db)`. */
  fns: ServerFunctions;
  children: React.ReactNode;
}

/**
 * Provides the server functions to all descendant components.
 *
 * Place this at the application root, wrapping `<RouterProvider>`:
 *
 * ```tsx
 * const fns = createServerFunctions(app, db);
 *
 * <ServerFunctionsProvider fns={fns}>
 *   <RouterProvider router={router} />
 * </ServerFunctionsProvider>
 * ```
 */
export function ServerFunctionsProvider({
  fns,
  children,
}: ServerFunctionsProviderProps): React.ReactElement {
  return (
    <ServerFunctionsContext.Provider value={fns}>
      {children}
    </ServerFunctionsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the server functions provided by the nearest
 * `<ServerFunctionsProvider>`.
 *
 * Throws a descriptive error when called outside a provider so the developer
 * gets an actionable message rather than a cryptic null-dereference.
 *
 * Requirements: 14.8
 */
export function useServerFunctions(): ServerFunctions {
  const ctx = useContext(ServerFunctionsContext);
  if (ctx === null) {
    throw new Error(
      "useServerFunctions must be used inside <ServerFunctionsProvider>",
    );
  }
  return ctx;
}
