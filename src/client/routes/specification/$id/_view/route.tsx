import { Outlet, createFileRoute } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { z } from 'zod';

import { EntitySidebar } from '@/client/components/EntitySidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/client/components/ui/resizable';

import { primeSpecificationEntities, useSpecificationEntities } from '../-specification-data.js';

const LazyGraphView = lazy(() => import('./-graph-view.js').then((m) => ({ default: m.GraphView })));

const viewSearchSchema = z.object({
  view: z.enum(['chat', 'graph']).optional().default('chat'),
});

function ViewLayout() {
  const entitySnapshot = useSpecificationEntities();
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

export const Route = createFileRoute('/specification/$id/_view')({
  validateSearch: viewSearchSchema,
  loader: ({ params }) => primeSpecificationEntities(params.id),
  component: ViewLayout,
});
