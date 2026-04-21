import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/client/components/app-shell';
import { ChatScroll } from '@/client/components/chat-scroll';
import { WorkspaceStateCard } from '@/client/components/control-cards';
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

import { useSpecificationEntities } from '../-specification-data.js';
import { useInterviewController } from './-interview-controller';
import { specificationWorkspaceStream, type WorkspaceStreamMarker } from './-workspace-stream-projector.js';
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

export function InterviewView({ phase }: { phase: WorkflowPhase }) {
  const [isClosePhaseModalOpen, setIsClosePhaseModalOpen] = useState(false);
  const entitySnapshot = useSpecificationEntities();
  const { chat, specification, workflow, phaseTurns, bottomArtifact, captureStatusByTurnId } =
    useInterviewController(phase, entitySnapshot);
  const phaseState = workflow.phases[phase];
  const currentReachablePhase = getCurrentOpenPhase(workflow.phases);
  const nextPhase = getNextActivePhase(workflow.phases, phase);
  const controlMarkers = projectLiveControlMarkers(chat.messages);
  const { streamArtifacts } = specificationWorkspaceStream({
    phase,
    phaseTurns,
    phaseState,
    bottomArtifact,
    controlMarkers,
  });
  const showLockedState =
    phaseState.status === 'unstarted' && currentReachablePhase !== phase && currentReachablePhase !== null;
  const phaseIndex = phaseOrder.indexOf(phase);
  const phaseNumber = phaseIndex + 1;
  const phaseTotal = phaseOrder.length;
  const showClosePhaseAction = canForceClosePhase(workflow, phase);
  const showAdvanceAction = phaseState.status === 'closed' && Boolean(nextPhase);
  const showExportAction = phaseState.status === 'closed' && !nextPhase;
  const readinessLabel = getReadinessLabel(phaseState.readiness);
  const turnCountLabel = `${phaseTurns.length} ${phaseTurns.length === 1 ? 'turn' : 'turns'}`;
  const confirmCloseLabel = `Confirm ${getWorkflowPhaseLabel(phase).toLowerCase()} closure`;

  const handleConfirmClosePhase = () => {
    setIsClosePhaseModalOpen(false);
    chat.forcePhaseClosure(phase);
  };

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-rule bg-background px-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-hint">
              Phase {phaseNumber}/{phaseTotal} – {getWorkflowPhaseLabel(phase)}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-base">
                <span className="text-sub">Status: </span>
                <span className="font-medium text-[#2070e6]">
                  {phaseState.status === 'in_progress'
                    ? 'In-Progress'
                    : phaseState.status === 'closed'
                      ? 'Closed'
                      : 'Unstarted'}
                </span>
              </span>
              <span className="text-hint">·</span>
              <span className="text-base text-sub">
                {phaseTurns.length} {phaseTurns.length === 1 ? 'Turn' : 'Turns'}
              </span>
              <span className="text-hint">·</span>
              <span className="text-base">
                <span className="text-sub">Readiness: </span>
                <span
                  className={cn(
                    'font-medium',
                    phaseState.readiness === 'high' && 'text-emerald-600',
                    phaseState.readiness === 'medium' && 'text-amber-600',
                    phaseState.readiness === 'low' && 'text-sub',
                  )}
                >
                  {readinessLabel}
                </span>
              </span>
            </div>
          </div>
          {showAdvanceAction ? (
            <Link
              to={getPhaseRoutePath(nextPhase!) as '/specification/$id/grounding'}
              params={{ id: String(specification.id) }}
              className="inline-flex h-8 items-center justify-center rounded-md bg-card px-3.5 text-sm font-medium whitespace-nowrap text-foreground shadow-[var(--shadow-card-ring)] transition-colors"
            >
              Advance to {getWorkflowPhaseLabel(nextPhase!)}
            </Link>
          ) : showExportAction ? (
            <Link
              to="/specification/$id/export"
              params={{ id: String(specification.id) }}
              className="inline-flex h-8 items-center justify-center rounded-md bg-card px-3.5 text-sm font-medium whitespace-nowrap text-foreground shadow-[var(--shadow-card-ring)] transition-colors"
            >
              Open export preview
            </Link>
          ) : showClosePhaseAction ? (
            <Button
              variant="outline"
              onClick={() => setIsClosePhaseModalOpen(true)}
              disabled={chat.isLoading}
            >
              Close Phase
            </Button>
          ) : null}
        </div>
        <ChatScroll className="min-h-0 flex-1">
          <div className="flex flex-col px-4 pt-3">
            {showLockedState && currentReachablePhase && (
              <div className="mx-auto w-full max-w-2xl">
                <WorkspaceStateCard
                  eyebrow="Locked phase"
                  title={`${getWorkflowPhaseLabel(phase)} phase is not available yet`}
                  description={`Finish or enter ${getWorkflowPhaseLabel(currentReachablePhase)} before opening this phase.`}
                >
                  <Link
                    to={getPhaseRoutePath(currentReachablePhase) as '/specification/$id/grounding'}
                    params={{ id: String(specification.id) }}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    Go to {getWorkflowPhaseLabel(currentReachablePhase)}
                  </Link>
                </WorkspaceStateCard>
              </div>
            )}

            <WorkspaceTranscriptArtifacts
              streamArtifacts={streamArtifacts}
              specificationId={String(specification.id)}
              phaseTurns={phaseTurns}
              captureStatusByTurnId={captureStatusByTurnId}
              showLockedState={showLockedState}
              renderPersistedActivity={renderPersistedActivity}
              renderLiveActivity={renderActivitySummary}
            />

            {/* Bottom spacer — future home of phase-advance controls */}
            <div className="h-30 shrink-0" />
          </div>
        </ChatScroll>
      </div>

      <Dialog open={isClosePhaseModalOpen} onOpenChange={setIsClosePhaseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {getWorkflowPhaseLabel(phase)} phase?</DialogTitle>
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
