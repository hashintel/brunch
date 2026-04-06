import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import type { ProjectListItem } from '../shared/api-types.js';
import { DebugSurfaceRouteComponent } from './routes/debug-surface.js';
import { ExportPreview } from './routes/ExportPreview.js';
import { InterviewWorkspace } from './routes/InterviewWorkspace.js';
import { ProjectList } from './routes/ProjectList.js';
import { fetchWorkspaceLoaderData } from './workspace/workspace-loader.js';

// Root layout
const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <Outlet />
    </div>
  ),
});

// GET /api/projects → project list
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: async () => {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to load projects');
    return res.json() as Promise<ProjectListItem[]>;
  },
  component: ProjectList,
});

// GET /api/projects/:id + /entities → interview workspace
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id',
  loader: async ({ params }) => fetchWorkspaceLoaderData(params.id),
  component: InterviewWorkspace,
});

// Export preview placeholder
const exportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id/export',
  component: ExportPreview,
});

const debugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/debug',
  component: DebugSurfaceRouteComponent,
});

const routeTree = rootRoute.addChildren([indexRoute, projectRoute, exportRoute, debugRoute]);

export const router = createRouter({ routeTree });

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
