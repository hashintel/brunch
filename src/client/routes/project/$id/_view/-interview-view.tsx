import { Link, useLoaderData } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { Message, MessageContent, MessageResponse } from '@/client/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/client/components/ai-elements/prompt-input';
import { ShellButton } from '@/client/components/app-shell';
import { ChatScroll } from '@/client/components/chat-scroll';
import {
  AcceptedClosureCard,
  KickoffControlCard,
  PhaseSummaryCard,
  RecoveryControlCard,
  ReviewPhaseBanner,
  TranscriptMetaPlaceholder,
  WorkspaceStateCard,
} from '@/client/components/control-cards';
import {
  ActiveReviewSetCard,
  ActiveQuestionCard,
  ActivityPlaceholder,
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
import { getNextActivePhase, phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';
import {
  getAcceptedClosureReplay,
  getPersistedActivitySummary,
  getPersistedReviewAction,
  getPersistedReviewSet,
  getPersistedSelectedPositions,
  getPersistedTurnResponse,
  turnHasCompletedAnswer,
  turnIsControlOrClosureArtifact,
} from '@/shared/project-state-turn.js';

import { useInterviewController } from './-interview-controller';
import { continuePhaseMessages, startPhaseMessages } from './-interview-controller-core.js';

function canForceClosePhase(workflow: ProjectState['workflow'], phase: ProjectStateTurn['phase']) {
  return getForceClosePhaseAction(workflow, phase).available;
}

function isReviewPhase(phase: WorkflowPhase) {
  return phase === 'requirements' || phase === 'criteria';
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

function getControlMarkerLabel(text: string): string | null {
  if (Object.values(startPhaseMessages).includes(text as (typeof startPhaseMessages)[WorkflowPhase])) {
    return 'Interview started';
  }

  if (Object.values(continuePhaseMessages).includes(text as (typeof continuePhaseMessages)[WorkflowPhase])) {
    return 'Interview resumed';
  }

  return null;
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
  const {
    chat,
    project,
    workflow,
    phaseTurns,
    phaseSummary,
    promptInput,
    activeArtifact,
    captureStatusByTurnId,
    showGeneratingState,
  } = useInterviewController(phase);
  const phaseState = workflow.phases[phase];
  const autoPresentKeyRef = useRef<string | null>(null);
  const currentReachablePhase =
    phaseOrder.find((candidate) => workflow.phases[candidate].status !== 'closed') ?? null;
  const nextPhase = getNextActivePhase(workflow.phases, phase);
  // TODO: re-enable when auto-present is restored
  const _hasVisibleActiveTurn =
    activeArtifact?.kind === 'pending-question' ||
    (activeArtifact?.kind === 'persisted-turn' && !turnHasCompletedAnswer(activeArtifact.turn));
  const renderedPersistedTurnId =
    activeArtifact?.kind === 'persisted-turn' &&
    (!turnHasCompletedAnswer(activeArtifact.turn) || activeArtifact.state === 'submitted')
      ? activeArtifact.turn.id
      : null;
  const completedPhaseItems = phaseTurns.reduce<
    Array<
      | { kind: 'answered-turn'; turn: ProjectStateTurn }
      | {
          kind: 'accepted-closure';
          acceptedClosure: NonNullable<ReturnType<typeof getAcceptedClosureReplay>>;
        }
      | {
          kind: 'answered-review-turn';
          turn: ProjectStateTurn;
          reviewSet: NonNullable<ReturnType<typeof getPersistedReviewSet>>;
        }
    >
  >((items, turn) => {
    if (turn.id === renderedPersistedTurnId) {
      return items;
    }

    const acceptedClosure = getAcceptedClosureReplay(turn, phaseState);
    if (acceptedClosure) {
      items.push({ kind: 'accepted-closure', acceptedClosure });
      return items;
    }

    if (turnHasCompletedAnswer(turn) && !turnIsControlOrClosureArtifact(turn)) {
      const reviewSet = getPersistedReviewSet(turn);
      if (reviewSet && getPersistedReviewAction(turn)) {
        items.push({ kind: 'answered-review-turn', turn, reviewSet });
      } else {
        items.push({ kind: 'answered-turn', turn });
      }
    }

    return items;
  }, []);
  const answeredTurnCount = completedPhaseItems.filter((item) => item.kind === 'answered-turn').length;
  const activeQuestionCode = `Q${answeredTurnCount + 1}`;
  const showLockedState =
    phaseState.status === 'unstarted' && currentReachablePhase !== phase && currentReachablePhase !== null;
  const showClosedState = phaseState.status === 'closed';
  const showCompletionState = showClosedState && !nextPhase;
  // TODO: auto-present is disabled while the phase-closure interaction model is being reworked.
  // Original computation kept as reference:
  // const autoPresentCommand =
  //   !showLockedState && !showClosedState && currentReachablePhase === phase &&
  //   !phaseSummary && !chat.isLoading && !hasVisibleActiveTurn
  //     ? phaseTurns.length === 0 ? startPhaseMessages[phase] : continuePhaseMessages[phase]
  //     : null;
  const autoPresentCommand = null;
  // TODO: prompt input is disabled while the phase-closure interaction model is being reworked.
  // The turn-card family owns user input; the generic composer will return when the
  // center-pane header controls phase start/continue lifecycle.
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
  const showPromptInput = false;

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
  }, [
    autoPresentCommand,
    chat.submitText,
    phase,
    phaseState.status,
    phaseState.turnId,
    phaseTurns.length,
    project.id,
  ]);

  const handleSubmit = (message: PromptInputMessage) => {
    chat.submitText(message.text ?? '');
  };

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

            {isReviewPhase(phase) && phaseState.status === 'in_progress' && (
              <ReviewPhaseBanner phase={phase} />
            )}

            {/* ── Zone 1: Preceding answered turns ──────────────────────── */}
            {completedPhaseItems.length > 0 && (
              <div className="flex flex-col gap-6">
                {completedPhaseItems.map((item, index) =>
                  item.kind === 'answered-turn' ? (
                    <div key={`answered-turn-${item.turn.id}`} className="flex flex-col">
                      {renderPersistedActivity(item.turn)}
                      <AnsweredQuestionCard
                        turn={item.turn}
                        questionCode={`Q${index + 1}`}
                        captureStatus={captureStatusByTurnId.get(item.turn.id)}
                      />
                    </div>
                  ) : item.kind === 'answered-review-turn' ? (
                    <div key={`answered-review-turn-${item.turn.id}`} className="flex flex-col">
                      {renderPersistedActivity(item.turn)}
                      <AnsweredReviewSetCard turn={item.turn} reviewSet={item.reviewSet} />
                    </div>
                  ) : (
                    <div
                      key={`accepted-closure-${item.acceptedClosure.turnId}`}
                      data-testid="accepted-closure-card"
                    >
                      {renderPersistedActivity(
                        phaseTurns.find((turn) => turn.id === item.acceptedClosure.turnId),
                      )}
                      <AcceptedClosureCard
                        phase={item.acceptedClosure.phase}
                        summary={item.acceptedClosure.summary}
                      />
                    </div>
                  ),
                )}
              </div>
            )}

            {chat.messages.map((message, messageIndex) => {
              if (/^turn-\d+-/.test(message.id)) {
                return null;
              }

              const isLastAssistant =
                message.role === 'assistant' && messageIndex === chat.messages.length - 1;
              const suppressPhaseSummary = Boolean(phaseSummary && isLastAssistant);

              if (message.role === 'user') {
                const textParts = message.parts?.filter((part) => part.type === 'text') ?? [];
                const marker = textParts
                  .map((part) => getControlMarkerLabel(part.text))
                  .find((label): label is string => Boolean(label));

                if (marker) {
                  return <TranscriptMetaPlaceholder key={message.id} label={marker} />;
                }

                return null;
              }

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

            {!phaseSummary && phaseState.status === 'in_progress' && canForceClosePhase(workflow, phase) && (
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

          {/* ── Zone 2: Divider between answered and frontier ─────────── */}
          {completedPhaseItems.length > 0 &&
            (activeArtifact?.kind === 'persisted-turn' ||
              activeArtifact?.kind === 'pending-question' ||
              showGeneratingState) && <hr className="my-6 border-rule" />}

          {/* ── Zone 3: Active frontier ──────────────────────────────── */}
          <div className="mx-auto w-full max-w-2xl">
            {activeArtifact?.kind === 'persisted-turn' &&
              (!turnHasCompletedAnswer(activeArtifact.turn) || activeArtifact.state === 'submitted') && (
                <div className="flex flex-col">
                  {renderPersistedActivity(activeArtifact.turn)}
                  {(() => {
                    const reviewSet = getPersistedReviewSet(activeArtifact.turn) ?? fallbackReviewSet;

                    if (reviewSet) {
                      return (
                        <ActiveReviewSetCard
                          key={`persisted-review-turn-${activeArtifact.turn.id}`}
                          question={activeArtifact.turn.question}
                          why={activeArtifact.turn.why}
                          options={activeArtifact.turn.options ?? []}
                          onSubmitResponse={activeArtifact.submitTurnResponse}
                          persistedFreeText={
                            getPersistedTurnResponse(activeArtifact.turn)?.freeText?.trim() ?? ''
                          }
                          hasPersistedResponse={
                            activeArtifact.state === 'submitted' &&
                            turnHasCompletedAnswer(activeArtifact.turn)
                          }
                          disabled={activeArtifact.disabled}
                          state={activeArtifact.state}
                          reviewSet={reviewSet}
                        />
                      );
                    }

                    return (
                      <ActiveQuestionCard
                        key={`persisted-turn-${activeArtifact.turn.id}`}
                        id={`persisted-turn-${activeArtifact.turn.id}`}
                        questionCode={activeQuestionCode}
                        question={activeArtifact.turn.question}
                        why={activeArtifact.turn.why}
                        impact={activeArtifact.turn.impact}
                        options={activeArtifact.turn.options ?? []}
                        onSubmitResponse={activeArtifact.submitTurnResponse}
                        persistedSelectedPositions={getPersistedSelectedPositions(activeArtifact.turn)}
                        persistedFreeText={
                          getPersistedTurnResponse(activeArtifact.turn)?.freeText?.trim() ?? ''
                        }
                        hasPersistedResponse={
                          activeArtifact.state === 'submitted' && turnHasCompletedAnswer(activeArtifact.turn)
                        }
                        disabled={activeArtifact.disabled}
                        state={activeArtifact.state}
                      />
                    );
                  })()}
                </div>
              )}

            {activeArtifact?.kind === 'pending-question' &&
              (fallbackReviewSet ? (
                <ActiveReviewSetCard
                  key={`pending-review-turn-${activeArtifact.pendingQuestion.id}`}
                  question={activeArtifact.pendingQuestion.question}
                  why={activeArtifact.pendingQuestion.why}
                  options={activeArtifact.pendingQuestion.options}
                  persistedFreeText=""
                  hasPersistedResponse={false}
                  disabled={activeArtifact.disabled}
                  state="active"
                  reviewSet={fallbackReviewSet}
                />
              ) : (
                <ActiveQuestionCard
                  key={activeArtifact.pendingQuestion.id}
                  id={activeArtifact.pendingQuestion.id}
                  questionCode={activeQuestionCode}
                  question={activeArtifact.pendingQuestion.question}
                  why={activeArtifact.pendingQuestion.why}
                  impact={activeArtifact.pendingQuestion.impact}
                  options={activeArtifact.pendingQuestion.options}
                  persistedSelectedPositions={[]}
                  persistedFreeText=""
                  hasPersistedResponse={false}
                  disabled={activeArtifact.disabled}
                  state="active"
                />
              ))}

            {activeArtifact?.kind === 'kickoff' && !showLockedState && (
              <KickoffControlCard
                phase={activeArtifact.kickoff.phase}
                mode={activeArtifact.kickoff.mode}
                onProceed={() => activeArtifact.submitKickoff()}
                onSelectStrategy={(mode) => activeArtifact.submitKickoff(mode)}
                disabled={activeArtifact.disabled}
              />
            )}

            {activeArtifact?.kind === 'recovery' && !showLockedState && (
              <RecoveryControlCard
                phase={activeArtifact.recovery.phase}
                onRecover={activeArtifact.submitRecovery}
                disabled={activeArtifact.disabled}
              />
            )}

            {activeArtifact?.kind === 'persisted-turn' && activeArtifact.errorMessage && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {activeArtifact.errorMessage}
              </p>
            )}

            {phaseSummary && (
              <div className="flex flex-col">
                {renderPersistedActivity(phaseTurns.find((turn) => turn.id === phaseSummary.turnId))}
                <PhaseSummaryCard
                  phase={phaseSummary.phase}
                  summary={phaseSummary.summary}
                  disabled={chat.isLoading}
                  onConfirm={() => chat.confirmPhaseClosure(phaseSummary.phase, phaseSummary.turnId)}
                />
              </div>
            )}

            {showGeneratingState && <GeneratingTurnPlaceholder />}
          </div>

          {/* Bottom spacer — future home of phase-advance controls */}
          <div className="h-30 shrink-0" />
        </div>
      </ChatScroll>

      {showClosedState &&
        (isReviewPhase(phase) ? (
          <div className="shrink-0 border-t border-rule bg-tint px-6 py-5">
            <div className="mx-auto w-full max-w-2xl">
              <ReviewPhaseCompletionCard
                testId="review-phase-completion-card"
                title={`${getWorkflowPhaseLabel(phase)} review is complete`}
                description={getReviewPhaseCompletionDescription(
                  phase,
                  phaseState.summary,
                  nextPhase ?? null,
                )}
                action={
                  showCompletionState ? (
                    <Link
                      to="/project/$id/export"
                      params={{ id: String(project.id) }}
                      className="mt-3 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                    >
                      Open export preview
                    </Link>
                  ) : nextPhase ? (
                    <Link
                      to={`/project/$id/${phaseRouteSegments[nextPhase]}` as '/project/$id/grounding'}
                      params={{ id: String(project.id) }}
                      className="mt-3 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                    >
                      Continue to {getWorkflowPhaseLabel(nextPhase)}
                    </Link>
                  ) : null
                }
              />
            </div>
          </div>
        ) : (
          <div
            className="flex min-h-[120px] shrink-0 flex-col items-start justify-center gap-3 border-t border-rule bg-tint px-6 py-5"
            data-testid="workspace-state-card"
          >
            <p className="text-sm font-medium text-ink">
              {showCompletionState
                ? 'The interview workspace is complete'
                : `${getWorkflowPhaseLabel(phase)} phase is complete`}
            </p>
            <p className="text-xs-plus leading-relaxed text-sub">
              {phaseState.summary ??
                (showCompletionState
                  ? 'All phases are closed. Review the export to inspect the current structured spec output.'
                  : 'This phase has been closed and handed off to the next phase.')}
            </p>
            {showCompletionState ? (
              <Link
                to="/project/$id/export"
                params={{ id: String(project.id) }}
                className="mt-1 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
              >
                Open export preview
              </Link>
            ) : nextPhase ? (
              <Link
                to={`/project/$id/${phaseRouteSegments[nextPhase]}` as '/project/$id/grounding'}
                params={{ id: String(project.id) }}
                className="mt-1 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
              >
                Continue to {getWorkflowPhaseLabel(nextPhase)}
              </Link>
            ) : null}
          </div>
        ))}

      {showPromptInput && (
        <div className="border-t px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea placeholder="Type a message..." disabled={promptInput.disabled} />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputSubmit status={chat.status} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      )}
    </div>
  );
}
