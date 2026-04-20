import { Link, useLoaderData } from '@tanstack/react-router';

import { Message, MessageContent, MessageResponse } from '@/client/components/ai-elements/message';
import { Button } from '@/client/components/app-shell';
import { ChatScroll } from '@/client/components/chat-scroll';
import { TranscriptMetaPlaceholder, WorkspaceStateCard } from '@/client/components/control-cards';
import { ActivityPlaceholder } from '@/client/components/question-cards';
import { cn } from '@/client/lib/utils';
import type { WorkflowPhase } from '@/shared/api-types.js';
import { isAskQuestionUIPart, summarizeAssistantActivity } from '@/shared/chat.js';
import type { BrunchUIMessage } from '@/shared/chat.js';
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
  return messages
    .filter((message) => !/^turn-\d+-/.test(message.id) && message.role === 'user')
    .map((message) => getControlMarkerLabel(message))
    .filter((label): label is string => Boolean(label))
    .map((label) => ({ label }));
}

function renderActivitySummary(activitySummary: { seconds?: number; tools: string[] } | null) {
  if (!activitySummary) {
    return null;
  }

  return <ActivityPlaceholder seconds={activitySummary.seconds} tools={activitySummary.tools} />;
}

function renderPersistedActivity(turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined) {
  return renderActivitySummary(getPersistedActivitySummary(turn));
}

function renderMessageParts(
  message: BrunchUIMessage,
  isStreaming: boolean,
  options?: { suppressStructuredQuestion?: boolean; suppressPhaseSummary?: boolean },
) {
  return message.parts?.map((part, index) => {
    if (part.type === 'reasoning' || part.type === 'step-start') {
      return null;
    }
    if (isAskQuestionUIPart(part) || part.type === 'tool-propose_phase_closure') {
      return null;
    }
    if (part.type === 'data-observer-result') {
      return null;
    }
    if (part.type === 'data-review-set') {
      return null;
    }
    if (part.type === 'data-activity-summary') {
      return null;
    }
    if (part.type === 'data-phase-summary') {
      if (options?.suppressPhaseSummary) {
        return null;
      }

      return (
        <TranscriptMetaPlaceholder
          key={index}
          testId="phase-summary-placeholder"
          label="Phase closure summary"
          detail={part.data.summary}
        />
      );
    }
    if (part.type === 'dynamic-tool') {
      return null;
    }
    if (part.type === 'text') {
      return (
        <MessageResponse key={index} isAnimating={isStreaming}>
          {part.text}
        </MessageResponse>
      );
    }
    return null;
  });
}

export function InterviewView({ phase }: { phase: WorkflowPhase }) {
  const entitySnapshot = useLoaderData({ from: '/specification/$id/_view' });
  const {
    chat,
    project: specification,
    workflow,
    phaseTurns,
    bottomArtifact,
    captureStatusByTurnId,
  } = useInterviewController(phase);
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
  const fallbackReviewSet =
    phase === 'requirements'
      ? {
          title: 'Requirements',
          items: entitySnapshot.requirements,
        }
      : phase === 'criteria'
        ? {
            title: 'Acceptance Criteria',
            items: entitySnapshot.criteria,
          }
        : undefined;
  const phaseIndex = phaseOrder.indexOf(phase);
  const phaseNumber = phaseIndex + 1;
  const phaseTotal = phaseOrder.length;
  const showClosePhaseAction = canForceClosePhase(workflow, phase);
  const showAdvanceAction = phaseState.status === 'closed' && Boolean(nextPhase);
  const showExportAction = phaseState.status === 'closed' && !nextPhase;

  return (
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
                {phaseState.readiness[0]!.toUpperCase() + phaseState.readiness.slice(1)}
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
          <Button variant="outline" onClick={() => chat.forcePhaseClosure(phase)} disabled={chat.isLoading}>
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
            fallbackReviewSet={fallbackReviewSet}
            phaseTurns={phaseTurns}
            captureStatusByTurnId={captureStatusByTurnId}
            showLockedState={showLockedState}
            renderPersistedActivity={renderPersistedActivity}
          />

          <div className="mx-auto w-full max-w-2xl">
            {chat.messages.map((message, messageIndex) => {
              if (/^turn-\d+-/.test(message.id) || message.role === 'user') {
                return null;
              }

              const isLastAssistant =
                message.role === 'assistant' && messageIndex === chat.messages.length - 1;
              const suppressPhaseSummary = Boolean(
                bottomArtifact?.kind === 'phase-summary' && isLastAssistant,
              );

              const activitySummary = summarizeAssistantActivity(message.parts);
              const renderedParts = renderMessageParts(message, isLastAssistant && chat.isStreaming, {
                suppressPhaseSummary,
              });
              const hasRenderedParts = renderedParts?.some((part) => part !== null) ?? false;

              if (!activitySummary && !hasRenderedParts) {
                return null;
              }

              return (
                <div key={message.id} className="flex flex-col">
                  {renderActivitySummary(activitySummary)}
                  {hasRenderedParts ? (
                    <Message from={message.role}>
                      <MessageContent>{renderedParts}</MessageContent>
                    </Message>
                  ) : null}
                </div>
              );
            })}

            {bottomArtifact?.kind !== 'phase-summary' &&
              phaseState.status === 'in_progress' &&
              !chat.isLoading &&
              canForceClosePhase(workflow, phase) && (
                <div className="my-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => chat.forcePhaseClosure(phase)}
                    disabled={chat.isLoading}
                    className={cn(
                      'rounded-md border px-3 py-2 text-xs transition-colors',
                      chat.isLoading
                        ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {getPhaseClosureCommandText({ kind: 'force-close-active-phase', phase })}
                  </button>
                </div>
              )}
          </div>

          {/* Bottom spacer — future home of phase-advance controls */}
          <div className="h-30 shrink-0" />
        </div>
      </ChatScroll>
    </div>
  );
}
