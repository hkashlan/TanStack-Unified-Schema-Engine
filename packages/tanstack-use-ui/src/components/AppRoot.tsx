

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import React, { useState } from "react";
import { appClient } from "@tanstack-use/core/client";
import type { SessionClient } from "@tanstack-use/core/client";
import { LoginForm } from "./LoginForm.js";

export interface MyRouterContext {
  queryClient: QueryClient;
  session: SessionClient | null;
}

export interface AppRootProps {
  children: React.ReactNode;
  loginDescription?: React.ReactNode;
}

export function AppRoot({ children, loginDescription }: AppRootProps) {
  const { queryClient } = useRouteContext({ strict: false }) as MyRouterContext;
  const { data: session, isPending } = appClient.auth.useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // While the session check is in-flight, render the shell so the router
  // can mount properly (including the /api/auth route that resolves the check).
  if (isPending) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
        </div>
      </QueryClientProvider>
    );
  }

  if (!session?.user) {
    const handleLogin = async (email: string, password: string) => {
      setError("");
      setLoading(true);
      try {
        const result = await appClient.auth.signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || "Sign in failed");
          return;
        }
        // Set the first organization as active so permission checks work.
        const orgs = await appClient.auth.organization.list();
        if (!orgs.error && orgs.data && orgs.data.length > 0) {
          await appClient.auth.organization.setActive({
            organizationId: orgs.data[0]?.id,
          });
        }
      } catch {
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <LoginForm onLogin={handleLogin} error={error} loading={loading} />
          {loginDescription ?? (
            <p className="mt-6 text-xs text-center text-neutral-400 dark:text-neutral-500">
              Built with {" "}
              <a
                href="https://better-auth.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                BETTER-AUTH
              </a>
              .
            </p>
          )}
        </div>
      </div>
    );
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
