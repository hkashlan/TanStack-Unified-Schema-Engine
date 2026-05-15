/** biome-ignore-all lint/a11y/useValidAnchor: no explain */

import { cn } from "../lib/utils.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field.js";
import { Input } from "./ui/input.js";

interface LoginFormProps extends React.ComponentProps<"div"> {
  onLogin?: (email: string, password: string) => void;
  error?: string;
  loading?: boolean;
}

export function LoginForm({ className, onLogin, error, loading, ...props }: LoginFormProps) {
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    onLogin?.(email, password);
  };
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  defaultValue="admin@example.com"
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  defaultValue="password123"
                  autoComplete="current-password"
                  required
                />
              </Field>
              {error && (
                <Field>
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </Field>
              )}
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? "Signing in…" : "Login"}
                </Button>
                <Button variant="outline" type="button">
                  Login with Google
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <a href="#">Sign up</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export type { LoginFormProps };
