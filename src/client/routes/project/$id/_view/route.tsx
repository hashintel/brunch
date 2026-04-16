import { Outlet, createFileRoute, useLoaderData } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { z } from 'zod';

import { EntitySidebar } from '@/client/components/EntitySidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/client/components/ui/resizable';
import type { EntitiesData } from '@/shared/api-types.js';

const LazyGraphView = lazy(() => import('./-graph-view.js').then((m) => ({ default: m.GraphView })));

const viewSearchSchema = z.object({
  view: z.enum(['chat', 'graph']).optional().default('chat'),
});

async function fetchViewLayoutLoaderData(projectId: string): Promise<EntitiesData> {
  const response = await fetch(`/api/projects/${projectId}/entities?mode=active-path`);
  if (!response.ok) {
    throw new Error('Failed to load project entities');
  }
  return (await response.json()) as EntitiesData;
}

function ViewLayout() {
  const entitySnapshot = useLoaderData({ from: '/project/$id/_view' });
  const { view } = Route.useSearch();

  if (view === 'graph') {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading graph view…</p>
          </div>
        }
      >
        <LazyGraphView entityState={entitySnapshot} />
      </Suspense>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={65} minSize={40}>
        <Outlet />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={35} minSize={20}>
        <EntitySidebar entityState={entitySnapshot} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export const Route = createFileRoute('/project/$id/_view')({
  validateSearch: viewSearchSchema,
  loader: ({ params }) => fetchViewLayoutLoaderData(params.id),
  component: ViewLayout,
});
