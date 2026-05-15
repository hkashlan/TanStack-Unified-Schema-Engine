import { type RegisteredRouter, redirect } from "@tanstack/react-router";
import { createMiddleware, type RequestMiddlewareWithTypes } from "@tanstack/react-start";
import type { Session } from "./server.js";
import { appServer } from "./server.js";

// TS2742 ("cannot be named without a reference to .pnpm/undici-types/...") is
// a known issue with inferred types that reference Node.js fetch types via
// pnpm store paths. Annotating with `RequestMiddlewareWithTypes<any, any, TContext>`
// gives TypeScript a stable, portable type to emit in declaration files while
// preserving the specific context shape for consumers.
// See: https://github.com/microsoft/TypeScript/issues/47663

type AuthMiddlewareContext = { session: Session; headers: Headers };

export const authMiddleware: RequestMiddlewareWithTypes<
  RegisteredRouter,
  unknown,
  AuthMiddlewareContext
> = createMiddleware().server(async ({ next, request }) => {
  const session = await appServer.auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect({ to: "/" });
  }

  return await next({
    context: {
      session: session as Session,
      headers: request.headers,
    },
  });
});
