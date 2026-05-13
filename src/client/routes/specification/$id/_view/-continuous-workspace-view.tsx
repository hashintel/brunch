import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

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
import type { ActivitySummary, BrunchUIMessage } from '@/shared/chat.js';
import { getForceClosePhaseAction, getPhaseClosureCommandText } from '@/shared/phase-close.js';
import {
  getCurrentOpenPhase,
  getNextActivePhase,
  getPhaseRoutePath,
  getWorkflowPhaseLabel,
  phaseOrder,
} from '@/shared/phase-descriptors.js';
import { getPhaseIntentMarkerLabel } from '@/shared/phase-intents.js';
import { getPersistedActivitySummary } from '@/shared/specification-state.js';
import type { SpecificationState, SpecificationTurn } from '@/shared/specification.js';

import { useSpecificationBundleData } from '../-specification-data.js';
import { useInterviewController } from './-interview-controller.js';
import {
  specificationWorkspaceStream,
  type WorkspaceStreamArtifact,
  type WorkspaceStreamMarker,
} from './-workspace-stream-projector.js';
import { WorkspaceTranscriptArtifacts } from './-workspace-transcript-artifacts.js';

function canForceClosePhase(workflow: SpecificationState['workflow'], phase: SpecificationTurn['phase']) {
  return getForceClosePhaseAction(workflow, phase).available;
}

function getControlMarkerLabel(message: BrunchUIMessage): string | null {
  const phaseIntent = message.parts?.find(
    (part): part is Extract<NonNullable<BrunchUIMessage['parts']>[number], { type: 'data-phase-intent' }> =>
      part.type === 'data-phase-intent',
  );
  if (phaseIntent) {
    return getPhaseIntentMarkerLabel(phaseIntent.data);
  }

  const phaseConfirmation = message.parts?.find(
    (part): part is Extract<NonNullable<BrunchUIMessage['parts']>[number], { type: 'data-confirmation' }> =>
      part.type === 'data-confirmation',
  );
  return phaseConfirmation ? getPhaseClosureCommandText(phaseConfirmation.data) : null;
}

function projectLiveControlMarkers(messages: readonly BrunchUIMessage[]): WorkspaceStreamMarker[] {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (!message || /^turn-\d+-/.test(message.id) || message.role !== 'user') {
      continue;
    }

    const label = getControlMarkerLabel(message);
    if (label) {
      return [{ label }];
    }
  }

  return [];
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

interface PhaseSection {
  readonly phase: WorkflowPhase;
  readonly artifacts: readonly WorkspaceStreamArtifact[];
  readonly phaseTurns: readonly SpecificationTurn[];
  readonly isActive: boolean;
}

export function ContinuousWorkspaceView({ initialPhase }: { initialPhase: WorkflowPhase }) {
  const [isClosePhaseModalOpen, setIsClosePhaseModalOpen] = useState(false);
  const specificationState = useSpecificationBundleData();
  const currentReachablePhase = getCurrentOpenPhase(specificationState.workflow.phases);
  const activePhase = currentReachablePhase ?? phaseOrder[phaseOrder.length - 1]!;

  const controller = useInterviewController(activePhase);
  const { specification, workflow, captureStatusByTurnId, structuralArtifactTurnIds } = controller;

  const sections = useMemo((): readonly PhaseSection[] => {
    const result: PhaseSection[] = [];

    for (const phase of phaseOrder) {
      const phaseState = workflow.phases[phase];

      if (phaseState.status === 'unstarted' && phase !== activePhase) {
        continue;
      }

      if (phase === activePhase) {
        const controlMarkers = projectLiveControlMarkers(controller.chat.messages);
        const { streamArtifacts } = specificationWorkspaceStream({
          phase,
          phaseTurns: controller.phaseTurns,
          phaseState,
          bottomArtifact: controller.bottomArtifact,
          controlMarkers,
          structuralArtifactTurnIds,
        });
        result.push({
          phase,
          artifacts: streamArtifacts,
          phaseTurns: controller.phaseTurns,
          isActive: true,
        });
      } else {
        const phaseTurns = specificationState.turns.filter((t) => t.phase === phase);
        const { streamArtifacts } = specificationWorkspaceStream({
          phase,
          phaseTurns,
          phaseState,
          bottomArtifact: null,
          structuralArtifactTurnIds: specificationState.structuralArtifactTurnIds,
        });
        result.push({ phase, artifacts: streamArtifacts, phaseTurns, isActive: false });
      }
    }

    return result;
  }, [activePhase, controller, specificationState, structuralArtifactTurnIds, workflow.phases]);

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
  const activePhaseTurns = controller.phaseTurns;
  const turnCountLabel = `${activePhaseTurns.length} ${activePhaseTurns.length === 1 ? 'turn' : 'turns'}`;
  const confirmCloseLabel = `Confirm ${getWorkflowPhaseLabel(activePhase).toLowerCase()} closure`;

  const handleConfirmClosePhase = () => {
    setIsClosePhaseModalOpen(false);
    controller.chat.forcePhaseClosure(activePhase);
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
              disabled={controller.chat.isLoading}
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
            <Button variant="primary" onClick={handleConfirmClosePhase} disabled={controller.chat.isLoading}>
              {confirmCloseLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
