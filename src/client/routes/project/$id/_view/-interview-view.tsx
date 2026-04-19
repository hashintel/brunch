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
import { getPhaseIntentMarkerLabel } from '@/shared/phase-intents.js';
import { getNextActivePhase, phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';
import {
  getPersistedActivitySummary,
  getPersistedReviewSet,
  getPersistedSelectedPositions,
  getPersistedTurnResponse,
  turnHasCompletedAnswer,
} from '@/shared/project-state-turn.js';

import { useInterviewController } from './-interview-controller';
import { continuePhaseMessages, startPhaseMessages } from './-interview-controller-core.js';
import { projectWorkspaceStream } from './-workspace-stream-projector.js';

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

function getControlMarkerLabel(message: BrunchUIMessage): string | null {
  const phaseIntent = message.parts?.find(
    (part): part is Extract<(typeof message.parts)[number], { type: 'data-phase-intent' }> =>
      part.type === 'data-phase-intent',
  );
  if (phaseIntent) {
    return getPhaseIntentMarkerLabel(phaseIntent.data);
  }

  const textParts = message.parts?.filter((part) => part.type === 'text') ?? [];
  for (const part of textParts) {
    if (Object.values(startPhaseMessages).includes(part.text as (typeof startPhaseMessages)[WorkflowPhase])) {
      return 'Interview started';
    }

    if (
      Object.values(continuePhaseMessages).includes(
        part.text as (typeof continuePhaseMessages)[WorkflowPhase],
      )
    ) {
      return 'Interview resumed';
    }
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
  const { chat, project, workflow, phaseTurns, promptInput, bottomArtifact, captureStatusByTurnId } =
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
  const { streamArtifacts, footerArtifact } = projectWorkspaceStream({
    phaseTurns,
    phaseState,
    bottomArtifact,
  });
  const historyArtifacts = streamArtifacts.filter(
    (artifact) =>
      artifact.kind === 'answered-turn' ||
      artifact.kind === 'answered-review-turn' ||
      artifact.kind === 'accepted-closure',
  );
  const bottomStreamArtifacts = streamArtifacts.filter(
    (artifact) =>
      artifact.kind === 'divider' ||
      artifact.kind === 'persisted-turn' ||
      artifact.kind === 'pending-question' ||
      artifact.kind === 'kickoff' ||
      artifact.kind === 'recovery' ||
      artifact.kind === 'phase-summary' ||
      artifact.kind === 'generating',
  );
  const showLockedState =
    phaseState.status === 'unstarted' && currentReachablePhase !== phase && currentReachablePhase !== null;
  // TODO: auto-present is disabled while the phase-closure interaction model is being reworked.
  // Original computation kept as reference:
  // const autoPresentCommand =
  //   !showLockedState && phaseState.status !== 'closed' && currentReachablePhase === phase &&
  //   bottomArtifact?.kind !== 'phase-summary' && !chat.isLoading && !hasVisibleActiveTurn
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
            {historyArtifacts.length > 0 && (
              <div className="flex flex-col gap-6">
                {historyArtifacts.map((artifact) =>
                  artifact.kind === 'answered-turn' ? (
                    <div key={`answered-turn-${artifact.turn.id}`} className="flex flex-col">
                      {renderPersistedActivity(artifact.turn)}
                      <AnsweredQuestionCard
                        turn={artifact.turn}
                        questionCode={artifact.questionCode}
                        captureStatus={captureStatusByTurnId.get(artifact.turn.id)}
                      />
                    </div>
                  ) : artifact.kind === 'answered-review-turn' ? (
                    <div key={`answered-review-turn-${artifact.turn.id}`} className="flex flex-col">
                      {renderPersistedActivity(artifact.turn)}
                      <AnsweredReviewSetCard turn={artifact.turn} reviewSet={artifact.reviewSet} />
                    </div>
                  ) : (
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
              const suppressPhaseSummary = Boolean(
                bottomArtifact?.kind === 'phase-summary' && isLastAssistant,
              );

              if (message.role === 'user') {
                const marker = getControlMarkerLabel(message);

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

          {/* ── Zone 2: Divider between answered and frontier ─────────── */}
          {bottomStreamArtifacts.some((artifact) => artifact.kind === 'divider') && (
            <hr className="my-6 border-rule" />
          )}

          {/* ── Zone 3: Bottom artifact ─────────────────────────────── */}
          <div className="mx-auto w-full max-w-2xl">
            {bottomStreamArtifacts.map((artifact) => {
              if (artifact.kind === 'divider') {
                return null;
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
                        options={artifact.artifact.turn.options ?? []}
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

              if (artifact.kind === 'pending-question') {
                return fallbackReviewSet ? (
                  <ActiveReviewSetCard
                    key={`pending-review-turn-${artifact.artifact.pendingQuestion.id}`}
                    question={artifact.artifact.pendingQuestion.question}
                    why={artifact.artifact.pendingQuestion.why}
                    options={artifact.artifact.pendingQuestion.options}
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

              return <GeneratingTurnPlaceholder key="generating-turn-placeholder" />;
            })}
          </div>

          {/* Bottom spacer — future home of phase-advance controls */}
          <div className="h-30 shrink-0" />
        </div>
      </ChatScroll>

      {footerArtifact &&
        (footerArtifact.isReviewPhase ? (
          <div className="shrink-0 border-t border-rule bg-tint px-6 py-5">
            <div className="mx-auto w-full max-w-2xl">
              <ReviewPhaseCompletionCard
                testId="review-phase-completion-card"
                title={`${getWorkflowPhaseLabel(footerArtifact.phase)} review is complete`}
                description={getReviewPhaseCompletionDescription(
                  footerArtifact.phase,
                  footerArtifact.summary,
                  footerArtifact.kind === 'phase-handoff' ? footerArtifact.nextPhase : null,
                )}
                action={
                  footerArtifact.kind === 'workflow-complete' ? (
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
                        `/project/$id/${phaseRouteSegments[footerArtifact.nextPhase]}` as '/project/$id/grounding'
                      }
                      params={{ id: String(project.id) }}
                      className="mt-3 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
                    >
                      Continue to {getWorkflowPhaseLabel(footerArtifact.nextPhase)}
                    </Link>
                  )
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
              {footerArtifact.kind === 'workflow-complete'
                ? 'The interview workspace is complete'
                : `${getWorkflowPhaseLabel(footerArtifact.phase)} phase is complete`}
            </p>
            <p className="text-xs-plus leading-relaxed text-sub">
              {footerArtifact.summary ??
                (footerArtifact.kind === 'workflow-complete'
                  ? 'All phases are closed. Review the export to inspect the current structured spec output.'
                  : 'This phase has been closed and handed off to the next phase.')}
            </p>
            {footerArtifact.kind === 'workflow-complete' ? (
              <Link
                to="/project/$id/export"
                params={{ id: String(project.id) }}
                className="mt-1 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
              >
                Open export preview
              </Link>
            ) : (
              <Link
                to={
                  `/project/$id/${phaseRouteSegments[footerArtifact.nextPhase]}` as '/project/$id/grounding'
                }
                params={{ id: String(project.id) }}
                className="mt-1 inline-flex h-8 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium text-ink shadow-[var(--shadow-card-ring)] transition-colors hover:bg-tint"
              >
                Continue to {getWorkflowPhaseLabel(footerArtifact.nextPhase)}
              </Link>
            )}
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
