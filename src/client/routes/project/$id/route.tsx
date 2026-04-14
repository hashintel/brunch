import { Link, Outlet, createFileRoute, useLoaderData, useParams } from '@tanstack/react-router';

import { Skeleton } from '@/client/components/ui/skeleton';
import { cn } from '@/client/lib/utils';
import type { ProjectState, WorkflowPhase, WorkflowPhaseState, WorkflowState } from '@/shared/api-types.js';
import { phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';

const phaseLabels: Record<WorkflowPhase, string> = {
  scope: 'Framing',
  design: 'Elicitation',
  requirements: 'Requirements Review',
  criteria: 'Acceptance Review',
};

function StatusIndicator({ status }: { status: WorkflowPhaseState['status'] }) {
  if (status === 'closed') {
    return (
      <span className="flex size-3.5 items-center justify-center">
        <span className="size-[10.5px] rounded-full bg-[#2070e6]" />
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="flex size-3.5 items-center justify-center">
        <span className="size-[10.5px] rounded-full border-[1.3px] border-[#2070e6]" />
      </span>
    );
  }
  return (
    <span className="flex size-3.5 items-center justify-center">
      <span className="size-[10.5px] rounded-full border-[1.3px] border-dashed border-[rgba(0,0,0,0.35)]" />
    </span>
  );
}

function ReadinessBadge({ readiness }: { readiness: WorkflowPhaseState['readiness'] }) {
  return (
    <span
      className={cn(
        'rounded px-1 py-0.5 text-[10px] font-medium leading-none capitalize',
        readiness === 'high' && 'bg-emerald-100 text-emerald-700',
        readiness === 'medium' && 'bg-amber-100 text-amber-700',
        readiness === 'low' && 'bg-zinc-100 text-zinc-500',
      )}
    >
      {readiness}
    </span>
  );
}

function StatusBadge({ status }: { status: WorkflowPhaseState['status'] }) {
  if (status === 'closed') {
    return (
      <span className="rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium leading-none text-sky-700">
        Done
      </span>
    );
  }

  if (status === 'unstarted') {
    return (
      <span className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium leading-none text-zinc-500">
        Unstarted
      </span>
    );
  }

  return null;
}

function CloseabilityIndicator({ closeable }: { closeable: boolean }) {
  if (!closeable) return null;
  return <span className="size-1.5 rounded-full bg-emerald-500" title="Closeable" />;
}

function getCurrentReachablePhase(workflow: WorkflowState): WorkflowPhase | null {
  return phaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? null;
}

export function PhaseNavigationSidebar({
  projectId,
  workflow,
}: {
  projectId: string;
  workflow: WorkflowState;
}) {
  const currentReachablePhase = getCurrentReachablePhase(workflow);

  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r border-rule bg-tint py-2"
      data-testid="phase-sidebar"
    >
      <nav className="flex flex-col gap-0.5 px-2" role="navigation" aria-label="Phase navigation">
        {phaseOrder.map((phase) => {
          const state = workflow.phases[phase];
          const segment = phaseRouteSegments[phase];
          const isReachable =
            state.status === 'closed' || currentReachablePhase === phase || currentReachablePhase === null;
          const sharedClassName = cn(
            'flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
            state.status === 'unstarted' ? 'text-sub' : 'text-ink',
            !isReachable && 'cursor-not-allowed opacity-70',
          );
          const sharedProps = {
            'data-phase': phase,
            'data-phase-status': state.status,
            'data-phase-readiness': state.readiness,
            'data-phase-closeable': String(state.closeability),
            'data-phase-reachable': String(isReachable),
          };

          const content = (
            <>
              <StatusIndicator status={state.status} />
              <span className="flex-1 text-left">{phaseLabels[phase]}</span>
              {state.status === 'in_progress' ? (
                <CloseabilityIndicator closeable={state.closeability} />
              ) : null}
              {state.status === 'in_progress' ? <ReadinessBadge readiness={state.readiness} /> : null}
              {state.status !== 'in_progress' ? <StatusBadge status={state.status} /> : null}
            </>
          );

          if (!isReachable) {
            return (
              <div key={phase} aria-disabled="true" className={sharedClassName} {...sharedProps}>
                {content}
              </div>
            );
          }

          return (
            <Link
              key={phase}
              // @ts-expect-error — dynamic route path from validated phase-route mapping
              to={`/project/$id/${segment}`}
              params={{ id: projectId }}
              activeProps={{ className: 'bg-white shadow-[var(--shadow-card-ring)]' }}
              className={sharedClassName}
              {...sharedProps}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

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
        <PhaseNavigationSidebar projectId={id} workflow={projectState.workflow} />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  },
});
