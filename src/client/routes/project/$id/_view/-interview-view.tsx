import { Link, useLoaderData } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { Message, MessageContent, MessageResponse } from '@/client/components/ai-elements/message';
import { ShellButton } from '@/client/components/app-shell';
import { ChatScroll } from '@/client/components/chat-scroll';
import {
  AcceptedClosureCard,
  KickoffControlCard,
  PhaseHandoffCard,
  PhaseSummaryCard,
  RecoveryControlCard,
  TranscriptMetaPlaceholder,
  WorkspaceStateCard,
} from '@/client/components/control-cards';
import {
  ActiveGroundingCard,
  ActiveReviewSetCard,
  ActiveQuestionCard,
  ActivityPlaceholder,
  AnsweredGroundingCard,
  AnsweredQuestionCard,
  AnsweredReviewSetCard,
  GeneratingTurnPlaceholder,
} from '@/client/components/question-cards';
import { ReviewPhaseCompletionCard } from '@/client/components/review-set-card';
import { cn } from '@/client/lib/utils';
import type { ProjectState, ProjectStateTurn, WorkflowPhase } from '@/shared/api-types.js';
import { isAskQuestionUIPart, summarizeAssistantActivity } from '@/shared/chat.js';
import type { BrunchUIMessage } from '@/shared/chat.js';
import { getForceClosePhaseAction, getPhaseClosureCommandText } from '@/shared/phase-close.js';
import { getWorkflowPhaseLabel } from '@/shared/phase-display.js';
import { getPhaseIntentMarkerLabel } from '@/shared/phase-intents.js';
import { getNextActivePhase, phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';
import {
  getPersistedActivitySummary,
  getPersistedReviewSet,
  getPersistedSelectedPositions,
  getPersistedTurnResponse,
  getReviewPositionForAction,
  turnHasCompletedAnswer,
} from '@/shared/project-state-turn.js';

import { useInterviewController } from './-interview-controller';
import { projectWorkspaceStream, type WorkspaceStreamMarker } from './-workspace-stream-projector.js';

function canForceClosePhase(workflow: ProjectState['workflow'], phase: ProjectStateTurn['phase']) {
  return getForceClosePhaseAction(workflow, phase).available;
}

function getReviewPhaseCompletionDescription(
  phase: WorkflowPhase,
  summary: string | null,
  nextPhase: WorkflowPhase | null,
) {
  if (summary) {
    return summary;
  }

  if (phase === 'requirements' && nextPhase) {
    return `The reviewed requirement set is accepted and ready for ${getWorkflowPhaseLabel(nextPhase).toLowerCase()}.`;
  }

  return 'The accepted criteria set is ready for export.';
}

function getControlMarkerLabel(message: BrunchUIMessage): string | null {
  const phaseIntent = message.parts?.find(
    (part): part is Extract<NonNullable<BrunchUIMessage['parts']>[number], { type: 'data-phase-intent' }> =>
      part.type === 'data-phase-intent',
  );
  return phaseIntent ? getPhaseIntentMarkerLabel(phaseIntent.data) : null;
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

function renderPersistedActivity(turn: Pick<ProjectStateTurn, 'assistant_parts'> | undefined) {
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
  const entitySnapshot = useLoaderData({ from: '/project/$id/_view' });
  const { chat, project, workflow, phaseTurns, bottomArtifact, captureStatusByTurnId } =
    useInterviewController(phase);
  const phaseState = workflow.phases[phase];
  const autoPresentKeyRef = useRef<string | null>(null);
  const currentReachablePhase =
    phaseOrder.find((candidate) => workflow.phases[candidate].status !== 'closed') ?? null;
  const nextPhase = getNextActivePhase(workflow.phases, phase);
  // TODO: re-enable when auto-present is restored
  const _hasVisibleActiveTurn =
    bottomArtifact?.kind === 'pending-question' ||
    (bottomArtifact?.kind === 'persisted-turn' && !turnHasCompletedAnswer(bottomArtifact.turn));
  const controlMarkers = projectLiveControlMarkers(chat.messages);
  const { streamArtifacts } = projectWorkspaceStream({
    phase,
    phaseTurns,
    phaseState,
    bottomArtifact,
    controlMarkers,
  });
  const showLockedState =
    phaseState.status === 'unstarted' && currentReachablePhase !== phase && currentReachablePhase !== null;
  // TODO: auto-present is disabled while the phase-closure interaction model is being reworked.
  const autoPresentCommand = null;
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
  // TODO: auto-present is disabled while the phase-closure interaction model is being reworked.
  // The effect was automatically submitting start/continue commands, which causes runaway
  // turn generation. Re-enable once the center-pane header owns phase lifecycle controls.
  useEffect(() => {
    if (!autoPresentCommand) {
      autoPresentKeyRef.current = null;
      return;
    }
    // Disabled: do not auto-submit.
    // const autoPresentKey = `${project.id}:${phase}:${phaseState.status}:${phaseState.turnId ?? 'none'}:${phaseTurns.length}:${autoPresentCommand}`;
    // if (autoPresentKeyRef.current === autoPresentKey) return;
    // autoPresentKeyRef.current = autoPresentKey;
    // chat.submitText(autoPresentCommand);
  }, [autoPresentCommand, phase, phaseState.status, phaseState.turnId, phaseTurns.length, project.id]);

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
            to={`/project/$id/${phaseRouteSegments[nextPhase!]}` as '/project/$id/grounding'}
            params={{ id: String(project.id) }}
            className="inline-flex h-8 items-center justify-center rounded-md px-3.5 text-sm font-medium whitespace-nowrap transition-colors bg-card text-foreground shadow-[var(--shadow-card-ring)]"
          >
            Advance to {getWorkflowPhaseLabel(nextPhase!)}
          </Link>
        ) : showExportAction ? (
          <Link
            to="/project/$id/export"
            params={{ id: String(project.id) }}
            className="inline-flex h-8 items-center justify-center rounded-md px-3.5 text-sm font-medium whitespace-nowrap transition-colors bg-card text-foreground shadow-[var(--shadow-card-ring)]"
          >
            Open export preview
          </Link>
        ) : showClosePhaseAction ? (
          <ShellButton
            variant="outline"
            onClick={() => chat.forcePhaseClosure(phase)}
            disabled={chat.isLoading}
          >
            Close Phase
          </ShellButton>
        ) : null}
      </div>
      <ChatScroll className="min-h-0 flex-1">
        <div className="flex flex-col px-4 pt-3">
          <div className="mx-auto w-full max-w-2xl">
            {showLockedState && currentReachablePhase && (
              <WorkspaceStateCard
                eyebrow="Locked phase"
                title={`${getWorkflowPhaseLabel(phase)} phase is not available yet`}
                description={`Finish or enter ${getWorkflowPhaseLabel(currentReachablePhase)} before opening this phase.`}
              >
                <Link
                  to={`/project/$id/${phaseRouteSegments[currentReachablePhase]}` as '/project/$id/grounding'}
                  params={{ id: String(project.id) }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  Go to {getWorkflowPhaseLabel(currentReachablePhase)}
                </Link>
              </WorkspaceStateCard>
            )}

            {streamArtifacts.map((artifact) => {
              if (artifact.kind === 'phase-marker' || artifact.kind === 'control-marker') {
                return (
                  <TranscriptMetaPlaceholder
                    key={`${artifact.kind}-${artifact.marker.label}`}
                    label={artifact.marker.label}
                    detail={artifact.marker.detail}
                    testId={artifact.marker.testId}
                  />
                );
              }

              if (artifact.kind === 'answered-turn') {
                return (
                  <div key={`answered-turn-${artifact.turn.id}`} className="flex flex-col">
                    {renderPersistedActivity(artifact.turn)}
                    <AnsweredQuestionCard
                      turn={artifact.turn}
                      questionCode={artifact.questionCode}
                      captureStatus={captureStatusByTurnId.get(artifact.turn.id)}
                    />
                  </div>
                );
              }

              if (artifact.kind === 'answered-grounding-card') {
                return (
                  <div key={`answered-grounding-card-${artifact.turn.id}`} className="flex flex-col">
                    {renderPersistedActivity(artifact.turn)}
                    <AnsweredGroundingCard groundingCard={artifact.groundingCard} turn={artifact.turn} />
                  </div>
                );
              }

              if (artifact.kind === 'answered-review-turn') {
                return (
                  <div key={`answered-review-turn-${artifact.turn.id}`} className="flex flex-col">
                    {renderPersistedActivity(artifact.turn)}
                    <AnsweredReviewSetCard turn={artifact.turn} reviewSet={artifact.reviewSet} />
                  </div>
                );
              }

              if (artifact.kind === 'accepted-closure') {
                return (
                  <div
                    key={`accepted-closure-${artifact.acceptedClosure.turnId}`}
                    data-testid="accepted-closure-card"
                  >
                    {renderPersistedActivity(artifact.turn)}
                    <AcceptedClosureCard
                      phase={artifact.acceptedClosure.phase}
                      summary={artifact.acceptedClosure.summary}
                    />
                  </div>
                );
              }

              if (artifact.kind === 'divider') {
                return <hr key="workspace-stream-divider" className="my-6 border-rule" />;
              }

              if (artifact.kind === 'persisted-turn') {
                const reviewSet = getPersistedReviewSet(artifact.artifact.turn) ?? fallbackReviewSet;

                return (
                  <div key={`persisted-turn-${artifact.artifact.turn.id}`} className="flex flex-col">
                    {renderPersistedActivity(artifact.artifact.turn)}
                    {reviewSet ? (
                      <ActiveReviewSetCard
                        question={artifact.artifact.turn.question}
                        why={artifact.artifact.turn.why}
                        onSubmitReviewAction={(reviewAction, freeText) => {
                          const position = getReviewPositionForAction(artifact.artifact.turn, reviewAction);
                          if (position === null) {
                            return;
                          }

                          return artifact.artifact.submitTurnResponse([position], freeText, reviewAction);
                        }}
                        persistedFreeText={
                          getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''
                        }
                        hasPersistedResponse={
                          artifact.artifact.state === 'submitted' &&
                          turnHasCompletedAnswer(artifact.artifact.turn)
                        }
                        disabled={artifact.artifact.disabled}
                        state={artifact.artifact.state}
                        reviewSet={reviewSet}
                      />
                    ) : (
                      <ActiveQuestionCard
                        id={`persisted-turn-${artifact.artifact.turn.id}`}
                        questionCode={artifact.questionCode}
                        question={artifact.artifact.turn.question}
                        why={artifact.artifact.turn.why}
                        impact={artifact.artifact.turn.impact}
                        options={artifact.artifact.turn.options ?? []}
                        onSubmitResponse={artifact.artifact.submitTurnResponse}
                        persistedSelectedPositions={getPersistedSelectedPositions(artifact.artifact.turn)}
                        persistedFreeText={
                          getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''
                        }
                        hasPersistedResponse={
                          artifact.artifact.state === 'submitted' &&
                          turnHasCompletedAnswer(artifact.artifact.turn)
                        }
                        disabled={artifact.artifact.disabled}
                        state={artifact.artifact.state}
                      />
                    )}
                    {artifact.artifact.errorMessage ? (
                      <p role="alert" className="mt-3 text-sm text-destructive">
                        {artifact.artifact.errorMessage}
                      </p>
                    ) : null}
                  </div>
                );
              }

              if (artifact.kind === 'persisted-grounding-card') {
                return (
                  <div
                    key={`persisted-grounding-card-${artifact.artifact.turn.id}`}
                    className="flex flex-col"
                  >
                    {renderPersistedActivity(artifact.artifact.turn)}
                    <ActiveGroundingCard
                      groundingCard={artifact.groundingCard}
                      onSubmitResponse={artifact.artifact.submitTurnResponse}
                      persistedFreeText={
                        getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''
                      }
                      hasPersistedResponse={
                        artifact.artifact.state === 'submitted' &&
                        turnHasCompletedAnswer(artifact.artifact.turn)
                      }
                      disabled={artifact.artifact.disabled}
                      state={artifact.artifact.state}
                      continuePosition={artifact.artifact.turn.options?.[0]?.position}
                    />
                    {artifact.artifact.errorMessage ? (
                      <p role="alert" className="mt-3 text-sm text-destructive">
                        {artifact.artifact.errorMessage}
                      </p>
                    ) : null}
                  </div>
                );
              }

              if (artifact.kind === 'pending-question') {
                return fallbackReviewSet ? (
                  <ActiveReviewSetCard
                    key={`pending-review-turn-${artifact.artifact.pendingQuestion.id}`}
                    question={artifact.artifact.pendingQuestion.question}
                    why={artifact.artifact.pendingQuestion.why}
                    persistedFreeText=""
                    hasPersistedResponse={false}
                    disabled={artifact.artifact.disabled}
                    state="active"
                    reviewSet={fallbackReviewSet}
                  />
                ) : (
                  <ActiveQuestionCard
                    key={artifact.artifact.pendingQuestion.id}
                    id={artifact.artifact.pendingQuestion.id}
                    questionCode={artifact.questionCode}
                    question={artifact.artifact.pendingQuestion.question}
                    why={artifact.artifact.pendingQuestion.why}
                    impact={artifact.artifact.pendingQuestion.impact}
                    options={artifact.artifact.pendingQuestion.options}
                    persistedSelectedPositions={[]}
                    persistedFreeText=""
                    hasPersistedResponse={false}
                    disabled={artifact.artifact.disabled}
                    state="active"
                  />
                );
              }

              if (artifact.kind === 'kickoff') {
                return !showLockedState ? (
                  <KickoffControlCard
                    key={`kickoff-${artifact.artifact.kickoff.phase}-${artifact.artifact.kickoff.mode}`}
                    phase={artifact.artifact.kickoff.phase}
                    mode={artifact.artifact.kickoff.mode}
                    onProceed={() => artifact.artifact.submitKickoff()}
                    onSelectStrategy={(mode) => artifact.artifact.submitKickoff(mode)}
                    disabled={artifact.artifact.disabled}
                  />
                ) : null;
              }

              if (artifact.kind === 'recovery') {
                return !showLockedState ? (
                  <RecoveryControlCard
                    key={`recovery-${artifact.artifact.recovery.phase}`}
                    phase={artifact.artifact.recovery.phase}
                    onRecover={artifact.artifact.submitRecovery}
                    disabled={artifact.artifact.disabled}
                  />
                ) : null;
              }

              if (artifact.kind === 'phase-summary') {
                return (
                  <div
                    key={`phase-summary-${artifact.artifact.phaseSummary.turnId}`}
                    className="flex flex-col"
                  >
                    {renderPersistedActivity(
                      phaseTurns.find((turn) => turn.id === artifact.artifact.phaseSummary.turnId),
                    )}
                    <PhaseSummaryCard
                      phase={artifact.artifact.phaseSummary.phase}
                      summary={artifact.artifact.phaseSummary.summary}
                      disabled={artifact.artifact.disabled}
                      onConfirm={artifact.artifact.confirmPhaseSummary}
                    />
                  </div>
                );
              }

              if (artifact.kind === 'generating') {
                return <GeneratingTurnPlaceholder key="generating-turn-placeholder" />;
              }

              if (artifact.artifact.isReviewPhase) {
                return (
                  <ReviewPhaseCompletionCard
                    key={`${artifact.kind}-${artifact.artifact.phase}`}
                    testId="review-phase-completion-card"
                    title={`${getWorkflowPhaseLabel(artifact.artifact.phase)} review is complete`}
                    description={getReviewPhaseCompletionDescription(
                      artifact.artifact.phase,
                      artifact.artifact.summary,
                      artifact.kind === 'phase-handoff' ? artifact.artifact.nextPhase : null,
                    )}
                    action={
                      artifact.kind === 'workflow-complete' ? (
                        <Link
                          to="/project/$id/export"
                          params={{ id: String(project.id) }}
                          className="mt-3 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                        >
                          Open export preview
                        </Link>
                      ) : (
                        <Link
                          to={
                            `/project/$id/${phaseRouteSegments[artifact.artifact.nextPhase]}` as '/project/$id/grounding'
                          }
                          params={{ id: String(project.id) }}
                          className="mt-3 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                        >
                          Continue to {getWorkflowPhaseLabel(artifact.artifact.nextPhase)}
                        </Link>
                      )
                    }
                  />
                );
              }

              if (artifact.kind === 'phase-handoff') {
                return (
                  <PhaseHandoffCard
                    key={`${artifact.kind}-${artifact.artifact.phase}`}
                    phase={artifact.artifact.phase}
                    nextPhase={artifact.artifact.nextPhase}
                    summary={artifact.artifact.summary}
                  >
                    <Link
                      to={
                        `/project/$id/${phaseRouteSegments[artifact.artifact.nextPhase]}` as '/project/$id/grounding'
                      }
                      params={{ id: String(project.id) }}
                      className="mt-1 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                    >
                      Continue to {getWorkflowPhaseLabel(artifact.artifact.nextPhase)}
                    </Link>
                  </PhaseHandoffCard>
                );
              }

              return (
                <div
                  key={`${artifact.kind}-${artifact.artifact.phase}`}
                  className="flex min-h-[120px] flex-col items-start justify-center gap-3 rounded-xl border border-rule bg-tint px-6 py-5"
                  data-testid="workspace-state-card"
                >
                  <p className="text-sm font-medium text-ink">The interview workspace is complete</p>
                  <p className="text-xs-plus leading-relaxed text-sub">
                    {artifact.artifact.summary ??
                      'All phases are closed. Review the export to inspect the current structured spec output.'}
                  </p>
                  <Link
                    to="/project/$id/export"
                    params={{ id: String(project.id) }}
                    className="mt-1 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                  >
                    Open export preview
                  </Link>
                </div>
              );
            })}

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
