import { createRootRoute } from '@tanstack/react-router';

import { RouteRoot } from './-route-root.js';

async function fetchAppConfig(): Promise<{ cwd: string }> {
  const response = await fetch('/api/config');
  if (!response.ok) return { cwd: '' };
  return (await response.json()) as { cwd: string };
}

export const Route = createRootRoute({
  loader: fetchAppConfig,
  component: function AppLayout() {
    const { cwd } = Route.useLoaderData();
    return <RouteRoot cwd={cwd} />;
  },
});
