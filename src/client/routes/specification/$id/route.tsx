import { Outlet, createFileRoute, useParams } from '@tanstack/react-router';

import { SideChatHost } from '@/client/components/side-chat-host.js';
import { Skeleton } from '@/client/components/ui/skeleton';

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

    return (
      <SideChatHost specificationId={specificationState.specification.id}>
        <div className="flex h-full">
          <PhaseNavigationSidebar
            specificationId={specificationId}
            specificationName={specificationState.specification.name}
            workflow={specificationState.workflow}
            turns={specificationState.turns}
          />
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </SideChatHost>
    );
  },
});
