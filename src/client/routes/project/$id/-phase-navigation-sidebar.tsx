import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';

import { ScrollArea } from '@/client/components/ui/scroll-area';
import { cn } from '@/client/lib/utils';
import type { WorkflowPhase, WorkflowPhaseState, WorkflowState } from '@/shared/api-types.js';
import {
  areAllWorkflowPhasesClosed,
  getCurrentOpenPhase,
  getPhaseRoutePath,
  getWorkflowPhaseLabel,
  phaseOrder,
} from '@/shared/phase-descriptors.js';
import type { SpecificationTurn } from '@/shared/specification.js';

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
  return getCurrentOpenPhase(workflow.phases);
}

function getPhaseTurnCounts(turns: readonly SpecificationTurn[]): Record<WorkflowPhase, number> {
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
  return areAllWorkflowPhasesClosed(workflow.phases);
}

function TimelineBullet({ status }: { status: WorkflowPhaseState['status'] | 'available' }) {
  if (status === 'closed' || status === 'available') {
    return <span className="relative z-[1] size-3 shrink-0 rounded-full bg-[#2070e6]" />;
  }

  if (status === 'in_progress') {
    return (
      <span className="relative z-[1] size-3 shrink-0 rounded-full border-[1.5px] border-[#2070e6] bg-background" />
    );
  }

  return (
    <span className="relative z-[1] size-3 shrink-0 rounded-full border-[1.5px] border-dashed border-[rgba(32,32,32,0.3)] bg-background" />
  );
}

function StatusMeta({ status }: { status: WorkflowPhaseState['status'] }) {
  return (
    <span
      className={cn(
        'text-xs font-medium',
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
        'rounded-full px-1.5 py-0.5 text-xs font-medium',
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
  specificationId,
  specificationName,
  workflow,
  turns,
}: {
  specificationId: string;
  specificationName: string;
  workflow: WorkflowState;
  turns: readonly SpecificationTurn[];
}) {
  const currentReachablePhase = getCurrentReachablePhase(workflow);
  const phaseTurnCounts = getPhaseTurnCounts(turns);
  const outputAvailable = allWorkflowPhasesClosed(workflow);

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-r border-rule bg-tint"
      data-testid="phase-sidebar"
    >
      <div className="flex h-16 shrink-0 items-center border-b border-rule bg-background px-3">
        <div className="flex flex-col gap-0.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-hint transition-colors hover:text-ink"
          >
            <ArrowLeftIcon className="size-3" />
            <span>Back to Workspace</span>
          </Link>
          <p className="truncate text-base leading-snug font-medium text-ink" title={specificationName}>
            {specificationName}
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="px-3 py-4" role="navigation" aria-label="Phase navigation">
          <ol className="relative ml-1.5">
            {phaseOrder.map((phase, index) => {
              const state = workflow.phases[phase];
              const isReachable =
                state.status === 'closed' ||
                currentReachablePhase === phase ||
                currentReachablePhase === null;
              const isLast = index === phaseOrder.length - 1 && !outputAvailable;
              const lineActive = state.status === 'closed';
              const sharedProps = {
                'data-phase': phase,
                'data-phase-status': state.status,
                'data-phase-readiness': state.readiness,
                'data-phase-closeable': String(state.closeability),
                'data-phase-reachable': String(isReachable),
                'data-phase-turn-count': String(phaseTurnCounts[phase]),
              };

              const body = (
                <div className="min-w-0">
                  <span
                    className={cn(
                      'inline-block text-sm leading-tight font-medium',
                      state.status === 'unstarted' ? 'text-hint' : 'text-sub',
                      'group-[.is-active]/phase:rounded-md group-[.is-active]/phase:bg-white group-[.is-active]/phase:px-2 group-[.is-active]/phase:py-0.5 group-[.is-active]/phase:text-ink',
                    )}
                  >
                    {getWorkflowPhaseLabel(phase)}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-sub">
                    <div className="flex items-center gap-1.5">
                      <StatusMeta status={state.status} />
                      {state.status === 'in_progress' ? <ReadinessMeta readiness={state.readiness} /> : null}
                    </div>
                    <span>{formatTurnCount(phaseTurnCounts[phase])}</span>
                  </div>
                </div>
              );

              return (
                <li
                  key={phase}
                  className={cn('relative flex items-start gap-3 pb-6', isLast && 'pb-0')}
                  aria-disabled={!isReachable ? 'true' : undefined}
                  {...sharedProps}
                >
                  {!isLast && (
                    <span
                      className={cn(
                        'absolute top-[16px] -bottom-[3px] left-[5px] w-0.5',
                        lineActive ? 'bg-[#2070e6]' : 'bg-rule',
                      )}
                    />
                  )}

                  <span className="mt-[4px] flex shrink-0 items-center justify-center">
                    <TimelineBullet status={state.status} />
                  </span>

                  {isReachable ? (
                    <Link
                      to={getPhaseRoutePath(phase) as '/project/$id/grounding'}
                      params={{ id: specificationId }}
                      activeProps={{ className: 'is-active' }}
                      className="group/phase block min-w-0 text-left transition-colors"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={cn(!isReachable && 'cursor-not-allowed opacity-75')}>{body}</div>
                  )}
                </li>
              );
            })}

            {outputAvailable ? (
              <li className="relative flex items-start gap-3">
                <span className="mt-[4px] flex shrink-0 items-center justify-center">
                  <TimelineBullet status="available" />
                </span>
                <Link
                  to="/project/$id/export"
                  params={{ id: specificationId }}
                  activeProps={{ className: 'is-active' }}
                  className="group/phase block min-w-0 text-left transition-colors"
                  data-phase="output"
                  data-phase-reachable="true"
                >
                  <span className="inline-block text-sm leading-tight font-medium text-sub group-[.is-active]/phase:rounded-md group-[.is-active]/phase:bg-white group-[.is-active]/phase:px-2 group-[.is-active]/phase:py-0.5 group-[.is-active]/phase:text-ink">
                    Output
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-sub">
                    <span className="font-medium text-[#2070e6]">Available</span>
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
