import { createFileRoute } from '@tanstack/react-router';

import { Skeleton } from '@/client/components/ui/skeleton';
import type { EntitiesData, ProjectState } from '@/shared/api-types.js';

import { KnowledgeView } from './-knowledge-view.js';

interface KnowledgeLoaderData {
  readonly entitySnapshot: EntitiesData;
}

async function fetchKnowledgeLoaderData(projectId: string): Promise<KnowledgeLoaderData> {
  const projectResponse = await fetch(`/api/projects/${projectId}`);
  if (!projectResponse.ok) {
    throw new Error('Failed to load project');
  }
  (await projectResponse.json()) as ProjectState;

  const entitiesResponse = await fetch(`/api/projects/${projectId}/entities?mode=active-path`);
  if (!entitiesResponse.ok) {
    throw new Error('Failed to load project entities');
  }
  const entitySnapshot = (await entitiesResponse.json()) as EntitiesData;

  return { entitySnapshot };
}

function KnowledgeSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-10 py-8">
      <div className="flex gap-6">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-1.5 h-5 w-8" />
        </div>
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-1.5 h-5 w-6" />
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-rule bg-tint">
            <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6" />
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/project/$id/knowledge')({
  loader: ({ params }) => fetchKnowledgeLoaderData(params.id),
  component: KnowledgeView,
  pendingComponent: KnowledgeSkeleton,
});
