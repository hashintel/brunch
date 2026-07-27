import { Outlet, createFileRoute, useLocation, useParams } from '@tanstack/react-router';
import { Suspense, lazy, type ReactNode } from 'react';
import { z } from 'zod';

import { ChatShellLayout } from '@/client/components/chat-shell-layout';
import { EntitySidebar } from '@/client/components/EntitySidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/client/components/ui/resizable';
import { workflowPhaseDescriptors } from '@/shared/phase-descriptors.js';

import { primeSpecificationEntities, useSpecificationEntities } from '../-specification-data.js';

const LazyGraphView = lazy(() => import('./-graph-view.js').then((m) => ({ default: m.GraphView })));

const viewSearchSchema = z.object({
  view: z.enum(['chat', 'graph']).optional().default('chat'),
});

function GraphViewScreen() {
  const entitySnapshot = useSpecificationEntities();

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

function EntitySidebarPane() {
  const entitySnapshot = useSpecificationEntities();
  const { id: specificationId } = Route.useParams();
  const { pathname } = useLocation();
  const currentPhase = workflowPhaseDescriptors.find((d) => pathname.endsWith(`/${d.routeSegment}`))?.phase;

  return (
    <EntitySidebar
      entityState={entitySnapshot}
      specificationId={specificationId}
      currentPhase={currentPhase}
    />
  );
}

function WorkspaceCenterPanels() {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={65} minSize={40}>
        <Outlet />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={35} minSize={20}>
        <EntitySidebarPane />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function ViewLayout() {
  const { view } = Route.useSearch();
  const { id: specificationId } = useParams({ from: '/specification/$id' });
  const center: ReactNode = view === 'graph' ? <GraphViewScreen /> : <WorkspaceCenterPanels />;
  return <ChatShellLayout specificationId={specificationId} center={center} />;
}

export const Route = createFileRoute('/specification/$id/_view')({
  validateSearch: viewSearchSchema,
  loader: ({ params }) => primeSpecificationEntities(params.id),
  component: ViewLayout,
});
