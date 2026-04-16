import { Outlet, createFileRoute, useLoaderData, useParams } from '@tanstack/react-router';

import { Skeleton } from '@/client/components/ui/skeleton';
import type { ProjectState } from '@/shared/api-types.js';

import { PhaseNavigationSidebar } from './-phase-navigation-sidebar.js';

function ProjectLayoutSkeleton() {
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

async function fetchProjectLayoutLoaderData(projectId: string): Promise<ProjectState> {
  const response = await fetch(`/api/projects/${projectId}`);
  if (!response.ok) {
    throw new Error('Failed to load project');
  }
  return (await response.json()) as ProjectState;
}

export const Route = createFileRoute('/project/$id')({
  loader: ({ params }) => fetchProjectLayoutLoaderData(params.id),
  pendingComponent: ProjectLayoutSkeleton,
  component: function ProjectLayout() {
    const projectState = useLoaderData({ from: '/project/$id' });
    const { id } = useParams({ from: '/project/$id' });
    return (
      <div className="flex h-full">
        <PhaseNavigationSidebar
          projectId={id}
          projectName={projectState.project.name}
          workflow={projectState.workflow}
          turns={projectState.turns}
        />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  },
});
