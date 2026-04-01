import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import { ExportPreview } from './routes/ExportPreview.js';
import { InterviewWorkspace } from './routes/InterviewWorkspace.js';
import { ProjectList } from './routes/ProjectList.js';

// Root layout
const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'system-ui' }}>
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
    return res.json() as Promise<Array<{ id: number; name: string; created_at: string; updated_at: string }>>;
  },
  component: ProjectList,
});

// GET /api/projects/:id → interview workspace
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id',
  loader: async ({ params }) => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (!res.ok) throw new Error('Failed to load project');
    return res.json() as Promise<{
      project: { id: number; name: string; active_turn_id: number | null };
      turns: Array<{ id: number; answer: string | null; question: string | null }>;
    }>;
  },
  component: InterviewWorkspace,
});

// Export preview placeholder
const exportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id/export',
  component: ExportPreview,
});

const routeTree = rootRoute.addChildren([indexRoute, projectRoute, exportRoute]);

export const router = createRouter({ routeTree });

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
