import { Link } from '@tanstack/react-router';

import type { WorkflowPhase, WorkflowPhaseState, WorkflowState } from '@/shared/api-types.js';
import { phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';

import { cn } from '../lib/utils.js';

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
        'rounded px-1 py-0.5 text-[10px] font-medium leading-none',
        readiness === 'high' && 'bg-emerald-100 text-emerald-700',
        readiness === 'medium' && 'bg-amber-100 text-amber-700',
        readiness === 'low' && 'bg-zinc-100 text-zinc-500',
      )}
    >
      {readiness}
    </span>
  );
}

function CloseabilityIndicator({ closeable }: { closeable: boolean }) {
  if (!closeable) return null;
  return <span className="size-1.5 rounded-full bg-emerald-500" title="Closeable" />;
}

export function PhaseNavigationSidebar({
  projectId,
  workflow,
}: {
  projectId: string;
  workflow: WorkflowState;
}) {
  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r border-rule bg-tint py-2"
      data-testid="phase-sidebar"
    >
      <nav className="flex flex-col gap-0.5 px-2" role="navigation" aria-label="Phase navigation">
        {phaseOrder.map((phase) => {
          const state = workflow.phases[phase];
          const segment = phaseRouteSegments[phase];
          return (
            <Link
              key={phase}
              // @ts-expect-error — dynamic route path from validated phase-route mapping
              to={`/project/$id/${segment}`}
              params={{ id: projectId }}
              activeProps={{ className: 'bg-white shadow-[var(--shadow-card-ring)]' }}
              className={cn(
                'flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                state.status === 'unstarted' ? 'text-sub' : 'text-ink',
              )}
              data-phase={phase}
              data-phase-status={state.status}
              data-phase-readiness={state.readiness}
              data-phase-closeable={state.closeability}
            >
              <StatusIndicator status={state.status} />
              <span className="flex-1 text-left">{phaseLabels[phase]}</span>
              <CloseabilityIndicator closeable={state.closeability} />
              <ReadinessBadge readiness={state.readiness} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
