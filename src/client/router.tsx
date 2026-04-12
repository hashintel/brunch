import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { InterviewWorkspaceSkeleton, KnowledgeWorkspaceSkeleton } from './components/route-skeletons.js';
import { fetchExportPreviewLoaderData } from './routes/export-loader.js';
import { ExportPreview } from './routes/ExportPreview.js';
import { InterviewWorkspace } from './routes/InterviewWorkspace.js';
import { KnowledgeWorkspace } from './routes/KnowledgeWorkspace.js';
import { fetchProjectListLoaderData } from './routes/project-list-loader.js';
import { ProjectList } from './routes/ProjectList.js';
import { RouteRoot } from './routes/RouteRoot.js';
import {
  fetchInterviewWorkspaceLoaderData,
  fetchKnowledgeWorkspaceLoaderData,
} from './workspace/workspace-loader.js';

// Root layout
const rootRoute = createRootRoute({
  component: RouteRoot,
});

// GET /api/projects → project list
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: fetchProjectListLoaderData,
  component: ProjectList,
});

// GET /api/projects/:id + /entities → interview workspace
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id',
  loader: async ({ params }) => fetchInterviewWorkspaceLoaderData(params.id),
  component: InterviewWorkspace,
  pendingComponent: InterviewWorkspaceSkeleton,
});

// Knowledge workspace — read-only review surface
const knowledgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id/knowledge',
  loader: async ({ params }) => fetchKnowledgeWorkspaceLoaderData(params.id),
  component: KnowledgeWorkspace,
  pendingComponent: KnowledgeWorkspaceSkeleton,
});

// Export preview placeholder
const exportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id/export',
  loader: async ({ params }) => fetchExportPreviewLoaderData(params.id),
  component: ExportPreview,
});

export const routeTree = rootRoute.addChildren([indexRoute, projectRoute, knowledgeRoute, exportRoute]);

export const router = createRouter({ routeTree });

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
