import { Outlet, createFileRoute, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';

import { PatchListProvider, type PatchAppliers } from '@/client/components/patch-list-host.js';
import { PatchListOverlay } from '@/client/components/patch-list-overlay.js';
import { SideChatHost } from '@/client/components/side-chat-host.js';
import { Skeleton } from '@/client/components/ui/skeleton';
import { makeAnnotateApplier } from '@/client/lib/annotation-api.js';
import { makeDrillDownApplier, makeEdgeApplier, makeEditApplier } from '@/client/lib/edit-applier.js';

import { PhaseNavigationSidebar } from './-phase-navigation-sidebar.js';
import { primeSpecificationBundle, useSpecificationBundleData } from './-specification-data.js';

function SpecificationWorkspaceSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-10 py-14">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-4 h-4 w-1/2" />
        <div className="mt-6 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/specification/$id')({
  loader: ({ params }) => primeSpecificationBundle(params.id),
  pendingComponent: SpecificationWorkspaceSkeleton,
  component: function SpecificationWorkspaceLayout() {
    const specificationState = useSpecificationBundleData();
    const { id: specificationId } = useParams({ from: '/specification/$id' });

    const appliers = useMemo<PatchAppliers>(() => {
      const specId = specificationState.specification.id;
      return {
        annotate: makeAnnotateApplier(specId),
        edit: makeEditApplier(specId),
        edge: makeEdgeApplier(specId),
        drillDown: makeDrillDownApplier(specId),
      };
    }, [specificationState.specification.id]);

    return (
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={specificationState.specification.id}>
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <PhaseNavigationSidebar
                specificationId={specificationId}
                specificationName={specificationState.specification.name}
                workflow={specificationState.workflow}
                turns={specificationState.turns}
              />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <PatchListOverlay />
                <div className="min-h-0 flex-1 overflow-hidden">
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </SideChatHost>
      </PatchListProvider>
    );
  },
});
