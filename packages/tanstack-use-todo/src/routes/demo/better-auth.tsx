import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";
import { LoginForm } from "#/components/login-form";

export const Route = createFileRoute("/demo/better-auth")({
  component: BetterAuthDemo,
});

function BetterAuthDemo() {
  const { data: session } = authClient.useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session?.user) {
    return (
      <div className="flex justify-center py-10 px-4">
        <div className="w-full max-w-md p-6 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold leading-none tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              You're signed in as {session.user.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="h-10 w-10" />
            ) : (
              <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {session.user.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {session.user.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              void authClient.signOut();
            }}
            className="w-full h-9 px-4 text-sm font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Sign out
          </button>

          <p className="text-xs text-center text-neutral-400 dark:text-neutral-500">
            Built with{" "}
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
        </div>
      </div>
    );
  }

  const handleLogin = async (email: string, password: string) => {
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "Sign in failed");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center py-10 px-4">
      <div className="w-full max-w-md">
        <LoginForm onLogin={handleLogin} error={error} loading={loading} />
        <p className="mt-6 text-xs text-center text-neutral-400 dark:text-neutral-500">
          Built with{" "}
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
      </div>
    </div>
  );
}
