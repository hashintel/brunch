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

function TimelineBullet({ status }: { status: WorkflowPhaseState['status'] | 'available' }) {
  if (status === 'closed' || status === 'available') {
    return <span className="relative z-[1] size-3.5 shrink-0 rounded-full bg-[#2070e6]" />;
  }

  if (status === 'in_progress') {
    return (
      <span className="relative z-[1] size-3.5 shrink-0 rounded-full border-[1.5px] border-[#2070e6] bg-background" />
    );
  }

  return (
    <span className="relative z-[1] size-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-[rgba(32,32,32,0.3)] bg-background" />
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
      <div className="flex h-16 shrink-0 items-center border-b border-rule bg-background px-3">
        <div className="flex flex-col gap-0.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-hint transition-colors hover:text-ink"
          >
            <ArrowLeftIcon className="size-3" />
            <span>Back to Workspace</span>
          </Link>
          <p className="truncate text-base font-medium leading-snug text-ink" title={projectName}>
            {projectName}
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="px-3 py-4" role="navigation" aria-label="Phase navigation">
          <ol className="relative ml-1.5">
            {phaseOrder.map((phase, index) => {
              const state = workflow.phases[phase];
              const segment = phaseRouteSegments[phase];
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
                  <div
                    className={cn(
                      'text-base font-medium leading-tight',
                      state.status === 'unstarted' ? 'text-sub' : 'text-ink',
                    )}
                  >
                    {getWorkflowPhaseLabel(phase)}
                  </div>
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
                  {/* Vertical line — runs from bullet to next bullet */}
                  {!isLast && (
                    <span
                      className={cn(
                        'absolute left-[6px] top-[17px] -bottom-[3px] w-0.5',
                        lineActive ? 'bg-[#2070e6]' : 'bg-rule',
                      )}
                    />
                  )}

                  {/* Bullet */}
                  <span className="mt-[3px] flex shrink-0 items-center justify-center">
                    <TimelineBullet status={state.status} />
                  </span>

                  {/* Body */}
                  {isReachable ? (
                    <Link
                      // @ts-expect-error — dynamic route path from validated phase-route mapping
                      to={`/project/$id/${segment}`}
                      params={{ id: projectId }}
                      className="block text-left transition-colors"
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
                <span className="mt-[3px] flex shrink-0 items-center justify-center">
                  <TimelineBullet status="available" />
                </span>
                <Link
                  to="/project/$id/export"
                  params={{ id: projectId }}
                  className="block text-left transition-colors"
                  data-phase="output"
                  data-phase-reachable="true"
                >
                  <div className="text-base font-medium leading-tight text-ink">Output</div>
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
