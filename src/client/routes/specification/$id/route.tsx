import { Outlet, createFileRoute, useParams } from '@tanstack/react-router';

import { Skeleton } from '@/client/components/ui/skeleton';
import type { SpecificationState } from '@/shared/specification.js';

import { PhaseNavigationSidebar } from './-phase-navigation-sidebar.js';
import { useSpecificationCoreData, useSpecificationTurns } from './-specification-data.js';

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

async function fetchSpecificationWorkspaceLoaderData(specificationId: string): Promise<SpecificationState> {
  const response = await fetch(`/api/specifications/${specificationId}`);
  if (!response.ok) {
    throw new Error('Failed to load specification');
  }
  return (await response.json()) as SpecificationState;
}

export const Route = createFileRoute('/specification/$id')({
  loader: ({ params }) => fetchSpecificationWorkspaceLoaderData(params.id),
  pendingComponent: SpecificationWorkspaceSkeleton,
  component: function SpecificationWorkspaceLayout() {
    const { specification, workflow } = useSpecificationCoreData();
    const turns = useSpecificationTurns();
    const { id: specificationId } = useParams({ from: '/specification/$id' });
    return (
      <div className="flex h-full">
        <PhaseNavigationSidebar
          specificationId={specificationId}
          specificationName={specification.name}
          workflow={workflow}
          turns={turns}
        />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  },
});
