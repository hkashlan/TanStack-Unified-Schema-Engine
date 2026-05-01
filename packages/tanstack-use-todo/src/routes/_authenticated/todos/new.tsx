import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/todos/new')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/todos/new"!</div>
}
