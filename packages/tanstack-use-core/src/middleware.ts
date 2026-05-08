import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { appServer } from "./server";

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const session = await appServer.auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw redirect({ to: "/" });
    }

    return await next({
      context: {
         session,
      },
    });
  },
);
