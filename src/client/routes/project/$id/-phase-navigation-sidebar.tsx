import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';

import { ScrollArea } from '@/client/components/ui/scroll-area';
import { cn } from '@/client/lib/utils';
import type {
  ProjectStateTurn,
  WorkflowPhase,
  WorkflowPhaseState,
  WorkflowState,
} from '@/shared/api-types.js';
import { getWorkflowPhaseLabel } from '@/shared/phase-display.js';
import { phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';

function formatStatus(status: WorkflowPhaseState['status']): string {
  switch (status) {
    case 'closed':
      return 'Closed';
    case 'in_progress':
      return 'In Progress';
    case 'unstarted':
      return 'Unstarted';
  }
}

function formatReadiness(readiness: WorkflowPhaseState['readiness']): string {
  return `${readiness[0]!.toUpperCase()}${readiness.slice(1)} readiness`;
}

function formatTurnCount(turnCount: number): string {
  return `${turnCount} ${turnCount === 1 ? 'turn' : 'turns'}`;
}

function getCurrentReachablePhase(workflow: WorkflowState): WorkflowPhase | null {
  return phaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? null;
}

function getPhaseTurnCounts(turns: readonly ProjectStateTurn[]): Record<WorkflowPhase, number> {
  const turnCounts = {
    scope: 0,
    design: 0,
    requirements: 0,
    criteria: 0,
  } satisfies Record<WorkflowPhase, number>;

  for (const turn of turns) {
    turnCounts[turn.phase] += 1;
  }

  return turnCounts;
}

function allWorkflowPhasesClosed(workflow: WorkflowState): boolean {
  return phaseOrder.every((phase) => workflow.phases[phase].status === 'closed');
}

function TimelineMarker({ status }: { status: WorkflowPhaseState['status'] | 'available' }) {
  if (status === 'closed' || status === 'available') {
    return <span className="size-2.5 rounded-full bg-[#2070e6]" />;
  }

  if (status === 'in_progress') {
    return <span className="size-2.5 rounded-full border-[1.4px] border-[#2070e6] bg-white" />;
  }

  return (
    <span className="size-2.5 rounded-full border-[1.4px] border-dashed border-[rgba(32,32,32,0.35)] bg-white" />
  );
}

function StatusMeta({ status }: { status: WorkflowPhaseState['status'] }) {
  return (
    <span
      className={cn(
        'text-xxs font-medium',
        status === 'closed' && 'text-[#2070e6]',
        status === 'in_progress' && 'text-[#2070e6]',
        status === 'unstarted' && 'text-sub',
      )}
    >
      {formatStatus(status)}
    </span>
  );
}

function ReadinessMeta({ readiness }: { readiness: WorkflowPhaseState['readiness'] }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-xxs font-medium',
        readiness === 'high' && 'bg-emerald-100 text-emerald-700',
        readiness === 'medium' && 'bg-amber-100 text-amber-700',
        readiness === 'low' && 'bg-zinc-100 text-zinc-500',
      )}
    >
      {formatReadiness(readiness)}
    </span>
  );
}

export function PhaseNavigationSidebar({
  projectId,
  projectName,
  workflow,
  turns,
}: {
  projectId: string;
  projectName: string;
  workflow: WorkflowState;
  turns: readonly ProjectStateTurn[];
}) {
  const currentReachablePhase = getCurrentReachablePhase(workflow);
  const phaseTurnCounts = getPhaseTurnCounts(turns);
  const outputAvailable = allWorkflowPhasesClosed(workflow);

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-r border-rule bg-tint"
      data-testid="phase-sidebar"
    >
      <div className="sticky top-0 z-10 border-b border-rule bg-tint px-3 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-sub transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>Back to Workspace</span>
        </Link>
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-xxs font-medium uppercase tracking-[0.08em] text-hint">Specification</span>
          <p className="text-sm font-medium leading-snug text-ink" title={projectName}>
            {projectName}
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="px-3 py-3" role="navigation" aria-label="Phase navigation">
          <ol className="flex flex-col gap-1.5">
            {phaseOrder.map((phase, index) => {
              const state = workflow.phases[phase];
              const segment = phaseRouteSegments[phase];
              const isReachable =
                state.status === 'closed' ||
                currentReachablePhase === phase ||
                currentReachablePhase === null;
              const previousPhase = index > 0 ? phaseOrder[index - 1] : null;
              const hasNextStep = index < phaseOrder.length - 1 || outputAvailable;
              const topSegmentComplete =
                previousPhase !== null && workflow.phases[previousPhase].status === 'closed';
              const bottomSegmentComplete = state.status === 'closed';
              const sharedClassName = cn(
                'mt-1 block min-h-16 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors',
                isReachable ? 'hover:bg-white/90' : 'cursor-not-allowed opacity-75',
                state.status === 'unstarted' ? 'text-sub' : 'text-ink',
              );
              const sharedProps = {
                'data-phase': phase,
                'data-phase-status': state.status,
                'data-phase-readiness': state.readiness,
                'data-phase-closeable': String(state.closeability),
                'data-phase-reachable': String(isReachable),
                'data-phase-turn-count': String(phaseTurnCounts[phase]),
              };
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight text-ink">
                        {getWorkflowPhaseLabel(phase)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xxs text-sub">
                        <StatusMeta status={state.status} />
                        {state.status === 'in_progress' ? (
                          <ReadinessMeta readiness={state.readiness} />
                        ) : null}
                        <span className="text-hint">•</span>
                        <span>{formatTurnCount(phaseTurnCounts[phase])}</span>
                      </div>
                    </div>
                  </div>
                </>
              );

              return (
                <li key={phase} className="grid min-h-[4.5rem] grid-cols-[1rem_minmax(0,1fr)] gap-3">
                  <div className="relative flex min-h-[4.5rem] justify-center">
                    {previousPhase !== null ? (
                      <span
                        className={cn(
                          'absolute top-0 h-1/2 w-px',
                          topSegmentComplete ? 'bg-[#2070e6]' : 'bg-rule',
                        )}
                      />
                    ) : null}
                    {hasNextStep ? (
                      <span
                        className={cn(
                          'absolute bottom-0 h-1/2 w-px',
                          bottomSegmentComplete ? 'bg-[#2070e6]' : 'bg-rule',
                        )}
                      />
                    ) : null}
                    <span className="relative mt-4 flex h-4 items-center justify-center bg-tint">
                      <TimelineMarker status={state.status} />
                    </span>
                  </div>

                  {isReachable ? (
                    <Link
                      // @ts-expect-error — dynamic route path from validated phase-route mapping
                      to={`/project/$id/${segment}`}
                      params={{ id: projectId }}
                      activeProps={{ className: 'border-rule bg-white shadow-[var(--shadow-card-ring)]' }}
                      className={sharedClassName}
                      {...sharedProps}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div aria-disabled="true" className={sharedClassName} {...sharedProps}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}

            {outputAvailable ? (
              <li className="grid min-h-[4.5rem] grid-cols-[1rem_minmax(0,1fr)] gap-3">
                <div className="relative flex min-h-[4.5rem] justify-center">
                  <span className="absolute top-0 h-1/2 w-px bg-[#2070e6]" />
                  <span className="relative mt-4 flex h-4 items-center justify-center bg-tint">
                    <TimelineMarker status="available" />
                  </span>
                </div>

                <Link
                  to="/project/$id/export"
                  params={{ id: projectId }}
                  activeProps={{ className: 'border-rule bg-white shadow-[var(--shadow-card-ring)]' }}
                  className="mt-1 block min-h-16 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-white/90"
                  data-phase="output"
                  data-phase-reachable="true"
                >
                  <div className="text-sm font-medium leading-tight text-ink">Output</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xxs text-sub">
                    <span className="font-medium text-[#2070e6]">Available</span>
                    <span className="text-hint">•</span>
                    <span>Markdown export</span>
                  </div>
                </Link>
              </li>
            ) : null}
          </ol>
        </nav>
      </ScrollArea>
    </aside>
  );
}
