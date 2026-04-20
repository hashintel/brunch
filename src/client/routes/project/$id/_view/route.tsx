import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/_view')({
  component: Outlet,
});
