import { createRootRoute } from '@tanstack/react-router';

import { RouteRoot } from './-route-root.js';

async function fetchAppConfig(): Promise<{ cwd: string; homedir: string }> {
  const response = await fetch('/api/config');
  if (!response.ok) return { cwd: '', homedir: '' };
  return (await response.json()) as { cwd: string; homedir: string };
}

function tildeShorten(path: string, homedir: string): string {
  if (homedir && path.startsWith(homedir)) {
    return '~' + path.slice(homedir.length);
  }
  return path;
}

export const Route = createRootRoute({
  loader: fetchAppConfig,
  component: function AppLayout() {
    const { cwd, homedir } = Route.useLoaderData();
    return <RouteRoot cwd={tildeShorten(cwd, homedir)} />;
  },
});
