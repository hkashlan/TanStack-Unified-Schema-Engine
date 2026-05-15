// tanstack-use-ui entry point

export type { AuthBeforeLoadOptions } from "./auth-guard.js";
// Auth guard
export { createAuthBeforeLoad } from "./auth-guard.js";
export type { CreatePageProps } from "./components/CreatePage.js";
export { CreatePage, FieldInput, FileFieldInput } from "./components/CreatePage.js";
export type { DetailPageProps } from "./components/DetailPage.js";

export { DetailPage, FieldDisplay } from "./components/DetailPage.js";
export type { ListPageProps } from "./components/ListPage.js";
// Page components
export { ListPage } from "./components/ListPage.js";
export type { LoginFormProps } from "./components/LoginForm.js";
// Auth Components
export { LoginForm } from "./components/LoginForm.js";
export type { ButtonProps } from "./components/ui/button.js";

// UI Components - Base
export { Button, buttonVariants } from "./components/ui/button.js";
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card.js";
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "./components/ui/field.js";

export { Input } from "./components/ui/input.js";

export { Label } from "./components/ui/label.js";

export { Separator } from "./components/ui/separator.js";
export type { RouteDescriptor } from "./create-routes.js";
// Route generation
export { buildRouteDescriptors, createRoutes } from "./create-routes.js";
// Label resolution
export { resolveLabel } from "./label-resolver.js";

// Utils
export { cn } from "./lib/utils.js";
