import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/client/components/app-shell';
import { ChatScroll } from '@/client/components/chat-scroll';
import { ActivityPlaceholder } from '@/client/components/question-cards';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog';
import { cn } from '@/client/lib/utils';
import type { WorkflowPhase } from '@/shared/api-types.js';
import type { ActivitySummary } from '@/shared/chat.js';
import { getForceClosePhaseAction } from '@/shared/phase-close.js';
import {
  getNextActivePhase,
  getPhaseRoutePath,
  getWorkflowPhaseLabel,
  phaseOrder,
} from '@/shared/phase-descriptors.js';
import { getPersistedActivitySummary } from '@/shared/specification-state.js';
import type { SpecificationState, SpecificationTurn } from '@/shared/specification.js';

import { useContinuousWorkspaceController } from './-continuous-workspace-controller.js';
import { WorkspaceTranscriptArtifacts } from './-workspace-transcript-artifacts.js';

function canForceClosePhase(workflow: SpecificationState['workflow'], phase: SpecificationTurn['phase']) {
  return getForceClosePhaseAction(workflow, phase).available;
}

function renderActivitySummary(activitySummary: ActivitySummary | null | undefined) {
  if (!activitySummary) {
    return null;
  }

  return <ActivityPlaceholder seconds={activitySummary.seconds} tools={activitySummary.tools} />;
}

function renderPersistedActivity(turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined) {
  return renderActivitySummary(getPersistedActivitySummary(turn));
}

function getReadinessLabel(readiness: SpecificationState['workflow']['phases'][WorkflowPhase]['readiness']) {
  return readiness[0]!.toUpperCase() + readiness.slice(1);
}

export function ContinuousWorkspaceView({ initialPhase }: { initialPhase: WorkflowPhase }) {
  const [isClosePhaseModalOpen, setIsClosePhaseModalOpen] = useState(false);

  const { specification, workflow, sections, activePhase, captureStatusByTurnId, chat } =
    useContinuousWorkspaceController();

  // Scroll to the initial phase section on mount
  const sectionRefs = useRef<Map<WorkflowPhase, HTMLDivElement>>(new Map());
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (hasScrolledRef.current) return;

    const targetPhase = sections.some((s) => s.phase === initialPhase) ? initialPhase : activePhase;
    const targetElement = sectionRefs.current.get(targetPhase);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
      hasScrolledRef.current = true;
    }
  }, [initialPhase, activePhase, sections]);

  const activePhaseState = workflow.phases[activePhase];
  const nextPhase = getNextActivePhase(workflow.phases, activePhase);
  const phaseIndex = phaseOrder.indexOf(activePhase);
  const phaseNumber = phaseIndex + 1;
  const phaseTotal = phaseOrder.length;
  const showClosePhaseAction = canForceClosePhase(workflow, activePhase);
  const showAdvanceAction = activePhaseState.status === 'closed' && Boolean(nextPhase);
  const showExportAction = activePhaseState.status === 'closed' && !nextPhase;
  const readinessLabel = getReadinessLabel(activePhaseState.readiness);
  const activeSection = sections.find((s) => s.isActive);
  const activePhaseTurns = activeSection?.phaseTurns ?? [];
  const turnCountLabel = `${activePhaseTurns.length} ${activePhaseTurns.length === 1 ? 'turn' : 'turns'}`;
  const confirmCloseLabel = `Confirm ${getWorkflowPhaseLabel(activePhase).toLowerCase()} closure`;

  const handleConfirmClosePhase = () => {
    setIsClosePhaseModalOpen(false);
    chat.forcePhaseClosure(activePhase);
  };

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-rule bg-background px-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-hint">
              Phase {phaseNumber}/{phaseTotal} – {getWorkflowPhaseLabel(activePhase)}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-snug">
                <span className="text-sub">Status: </span>
                <span
                  className={cn(
                    'font-medium',
                    activePhaseState.status === 'in_progress' && 'text-amber-600',
                    activePhaseState.status === 'closed' && 'text-[#2070e6]',
                    activePhaseState.status === 'unstarted' && 'text-sub',
                  )}
                >
                  {activePhaseState.status === 'in_progress'
                    ? 'In-Progress'
                    : activePhaseState.status === 'closed'
                      ? 'Closed'
                      : 'Unstarted'}
                </span>
              </span>
              <span className="text-hint">·</span>
              <span className="text-base text-sub">
                {activePhaseTurns.length} {activePhaseTurns.length === 1 ? 'Turn' : 'Turns'}
              </span>
            </div>
          </div>
          {showAdvanceAction && nextPhase ? (
            <Link
              to={getPhaseRoutePath(nextPhase) as '/specification/$id/grounding'}
              params={{ id: String(specification.id) }}
              className="inline-flex h-8 items-center justify-center rounded-md bg-card px-3.5 text-sm font-medium whitespace-nowrap text-foreground shadow-[var(--shadow-card-ring)] transition-colors"
            >
              Advance to {getWorkflowPhaseLabel(nextPhase)}
            </Link>
          ) : showExportAction ? (
            <Link
              to="/specification/$id/export"
              params={{ id: String(specification.id) }}
              className="inline-flex h-8 items-center justify-center rounded-md bg-card px-3.5 text-sm font-medium whitespace-nowrap text-foreground shadow-[var(--shadow-card-ring)] transition-colors"
            >
              Open export preview
            </Link>
          ) : null}
        </div>
        <ChatScroll className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 px-4 pt-3">
            {sections.map((section) => (
              <div
                key={section.phase}
                data-phase-section={section.phase}
                ref={(el) => {
                  if (el) {
                    sectionRefs.current.set(section.phase, el);
                  }
                }}
              >
                <WorkspaceTranscriptArtifacts
                  streamArtifacts={section.artifacts}
                  specificationId={String(specification.id)}
                  phaseTurns={section.phaseTurns}
                  captureStatusByTurnId={captureStatusByTurnId}
                  showLockedState={false}
                  renderPersistedActivity={renderPersistedActivity}
                  renderLiveActivity={renderActivitySummary}
                />
              </div>
            ))}

            <div className="h-8 shrink-0" />
          </div>
        </ChatScroll>
        {showClosePhaseAction && activePhaseTurns.length >= 3 && (
          <div className="flex shrink-0 items-center justify-center border-t border-rule bg-tint px-4 py-3">
            <Button
              variant="outline"
              onClick={() => setIsClosePhaseModalOpen(true)}
              disabled={chat.isLoading}
            >
              Close Phase
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isClosePhaseModalOpen} onOpenChange={setIsClosePhaseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {getWorkflowPhaseLabel(activePhase)} phase?</DialogTitle>
            <DialogDescription>
              This will record a user-forced close for the active phase without waiting for an interviewer
              recommendation.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sub">Readiness</dt>
              <dd className="font-medium text-foreground">{readinessLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sub">Turn count</dt>
              <dd className="font-medium text-foreground">{turnCountLabel}</dd>
            </div>
          </dl>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsClosePhaseModalOpen(false)}>
              Keep phase open
            </Button>
            <Button variant="primary" onClick={handleConfirmClosePhase} disabled={chat.isLoading}>
              {confirmCloseLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
