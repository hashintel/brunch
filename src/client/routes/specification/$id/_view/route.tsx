import { Outlet, createFileRoute, useLocation, useParams } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { z } from 'zod';

import { EntitySidebar } from '@/client/components/EntitySidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/client/components/ui/resizable';
import { UnifiedChatShell, type ChatLayoutMode } from '@/client/components/unified-chat-shell';
import { useChatLayoutMode } from '@/client/components/use-chat-layout-mode';
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

// FE-716 C13: per-mode shell footprint per UNIFIED_CHAT_UX.md §4.
//  - Compact: floating dock (~360–420 px); the workspace center fills.
//  - Side-docked (default): right rail at ~50% width.
//  - Maximize: chat at ~70% width, center at ~30%.
//  - Full: chat at 100%; the workspace center is hidden.
const LAYOUT_MODE_SHELL_PERCENT: Record<'side-docked' | 'maximize', number> = {
  'side-docked': 50,
  maximize: 70,
};

function ResizableLayout({
  layoutMode,
  setLayoutMode,
}: {
  layoutMode: 'side-docked' | 'maximize';
  setLayoutMode: (mode: ChatLayoutMode) => void;
}) {
  const shellSize = LAYOUT_MODE_SHELL_PERCENT[layoutMode];
  const centerSize = 100 - shellSize;
  // `key` on the outer group forces a remount when the mode changes so
  // ResizablePanelGroup picks up the new defaultSize values cleanly.
  return (
    <ResizablePanelGroup
      key={layoutMode}
      orientation="horizontal"
      className="h-full"
      data-testid="specification-view-layout"
      data-shell-layout-mode={layoutMode}
    >
      <ResizablePanel defaultSize={centerSize} minSize={20}>
        <WorkspaceCenterPanels />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={shellSize} minSize={20}>
        <UnifiedChatShell layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function CompactLayout({ setLayoutMode }: { setLayoutMode: (mode: ChatLayoutMode) => void }) {
  return (
    <div className="relative h-full" data-testid="specification-view-layout" data-shell-layout-mode="compact">
      <div className="h-full">
        <WorkspaceCenterPanels />
      </div>
      <div
        data-testid="unified-chat-shell-compact-dock"
        className="pointer-events-auto absolute right-4 bottom-4 z-30 flex w-[380px] max-w-[420px] min-w-[360px] flex-col overflow-hidden rounded-lg border border-rule bg-background shadow-lg"
        style={{ maxHeight: 'calc(100% - 2rem)' }}
      >
        <UnifiedChatShell layoutMode="compact" onLayoutModeChange={setLayoutMode} />
      </div>
    </div>
  );
}

function FullLayout({ setLayoutMode }: { setLayoutMode: (mode: ChatLayoutMode) => void }) {
  return (
    <div className="h-full" data-testid="specification-view-layout" data-shell-layout-mode="full">
      <UnifiedChatShell layoutMode="full" onLayoutModeChange={setLayoutMode} />
    </div>
  );
}

function ViewLayout() {
  const { view } = Route.useSearch();
  const { id: specificationId } = useParams({ from: '/specification/$id' });
  const { layoutMode, setLayoutMode } = useChatLayoutMode(specificationId);

  if (view === 'graph') {
    return <GraphViewScreen />;
  }

  // FE-716 C12/C13: UnifiedChatShell mounts as a peer to the workspace
  // center (Outlet + EntitySidebar). The four modes map to the layouts
  // below; Esc decrements one tier per UNIFIED_CHAT_UX.md §10.
  if (layoutMode === 'full') {
    return <FullLayout setLayoutMode={setLayoutMode} />;
  }
  if (layoutMode === 'compact') {
    return <CompactLayout setLayoutMode={setLayoutMode} />;
  }
  return <ResizableLayout layoutMode={layoutMode} setLayoutMode={setLayoutMode} />;
}

export const Route = createFileRoute('/specification/$id/_view')({
  validateSearch: viewSearchSchema,
  loader: ({ params }) => primeSpecificationEntities(params.id),
  component: ViewLayout,
});
