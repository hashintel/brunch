import { Link, useLoaderData } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { Message, MessageContent, MessageResponse } from '@/client/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/client/components/ai-elements/prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/client/components/ai-elements/reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/client/components/ai-elements/tool';
import { ShellButton } from '@/client/components/app-shell';
import { ChatScroll } from '@/client/components/chat-scroll';
import {
  ActiveQuestionCard,
  AnsweredQuestionCard,
  GeneratingTurnPlaceholder,
} from '@/client/components/question-cards';
import { cn } from '@/client/lib/utils';
import type {
  EntitiesData,
  ProjectMode,
  ProjectState,
  ProjectStateTurn,
  WorkflowPhase,
} from '@/shared/api-types.js';
import { isAskQuestionUIPart } from '@/shared/chat.js';
import type { AskQuestionUIPart, BrunchUIMessage } from '@/shared/chat.js';
import {
  groundingStrategyChoices,
  groundingStrategyKickoffDescription,
  groundingStrategyKickoffQuestion,
} from '@/shared/grounding-strategy.js';
import { getForceClosePhaseAction, getPhaseClosureCommandText } from '@/shared/phase-close.js';
import { getWorkflowPhaseLabel } from '@/shared/phase-display.js';
import { getNextActivePhase, phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';
import {
  getAcceptedClosureReplay,
  getPersistedSelectedPositions,
  getPersistedTurnResponse,
  safeParsePersistedAssistantParts,
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

function TranscriptMetaPlaceholder({
  label,
  detail,
  testId,
}: {
  label: string;
  detail?: string | null;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="my-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      <p className="font-medium text-foreground/80">{label}</p>
      {detail ? <p className="mt-1 leading-relaxed">{detail}</p> : null}
    </div>
  );
}

function WorkspaceStateCard({
  eyebrow,
  title,
  description,
  children,
  testId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="my-3 rounded-xl border bg-card p-4 shadow-sm"
      {...(testId ? { 'data-testid': testId } : { 'data-testid': 'workspace-state-card' })}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function ReviewPhaseBanner({ phase }: { phase: WorkflowPhase }) {
  return (
    <TranscriptMetaPlaceholder
      testId="review-phase-banner"
      label={`${getWorkflowPhaseLabel(phase)} workspace`}
      detail="This phase is staged as a structured review, not a freeform chat transcript."
    />
  );
}

function KickoffTurnCard({
  phase,
  mode,
  onProceed,
  onSelectStrategy,
  disabled,
}: {
  phase: WorkflowPhase;
  mode: 'start' | 'continue';
  onProceed: () => void;
  onSelectStrategy?: (mode: ProjectMode) => void;
  disabled: boolean;
}) {
  const phaseLabel = getWorkflowPhaseLabel(phase);
  const showsGroundingStrategyChoice = phase === 'scope' && mode === 'start' && Boolean(onSelectStrategy);

  return (
    <WorkspaceStateCard
      testId="kickoff-turn-card"
      eyebrow={mode === 'start' ? 'Phase kickoff' : 'Continue phase'}
      title={showsGroundingStrategyChoice ? groundingStrategyKickoffQuestion : `${phaseLabel} phase`}
      description={
        showsGroundingStrategyChoice
          ? groundingStrategyKickoffDescription
          : mode === 'start'
            ? `This phase is ready to begin. Proceed to generate the first ${isReviewPhase(phase) ? 'review step' : 'interview turn'}.`
            : `This phase is open but has no current frontier turn. Proceed to generate the next ${isReviewPhase(phase) ? 'review step' : 'interview turn'}.`
      }
    >
      {showsGroundingStrategyChoice ? (
        <div className="flex w-full flex-col gap-3">
          {groundingStrategyChoices.map((choice) => (
            <button
              key={choice.mode}
              type="button"
              data-testid={`kickoff-strategy-option-${choice.mode}`}
              onClick={() => onSelectStrategy?.(choice.mode)}
              disabled={disabled}
              className={cn(
                'rounded-lg border border-input p-4 text-left transition-colors',
                disabled
                  ? 'cursor-not-allowed bg-muted text-muted-foreground'
                  : 'bg-background hover:bg-muted/50',
              )}
            >
              <div className="font-medium">{choice.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{choice.description}</div>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onProceed}
          disabled={disabled}
          className={cn(
            'rounded-md border px-3 py-2 text-sm transition-colors',
            disabled
              ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
              : 'border-border bg-background hover:bg-muted',
          )}
        >
          Proceed
        </button>
      )}
    </WorkspaceStateCard>
  );
}

function RecoveryTurnCard({
  phase,
  onRecover,
  disabled,
}: {
  phase: WorkflowPhase;
  onRecover: () => void;
  disabled: boolean;
}) {
  return (
    <WorkspaceStateCard
      eyebrow="Recovery needed"
      title={`Restore the next ${isReviewPhase(phase) ? 'review step' : 'interview turn'}`}
      description={`The last ${getWorkflowPhaseLabel(phase).toLowerCase()} turn is complete, but the next frontier is missing. Continue to recover it.`}
    >
      <button
        type="button"
        data-testid="recovery-turn-card"
        onClick={onRecover}
        disabled={disabled}
        className={cn(
          'rounded-md border px-3 py-2 text-sm transition-colors',
          disabled
            ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
            : 'border-border bg-background hover:bg-muted',
        )}
      >
        Continue
      </button>
    </WorkspaceStateCard>
  );
}

function PhaseSummaryCard({
  phase,
  summary,
  onConfirm,
  disabled,
}: {
  phase: ProjectStateTurn['phase'];
  summary: string;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <div className="my-3 rounded-lg border bg-card p-4">
      <div className="mb-2 text-[15px] font-semibold">{getWorkflowPhaseLabel(phase)} closure proposal</div>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={cn(
            'rounded-md border px-3 py-2 text-sm transition-colors',
            disabled
              ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
              : 'border-border bg-background hover:bg-muted',
          )}
        >
          {getPhaseClosureCommandText({ kind: 'confirm-proposed-phase-closure', phase })}
        </button>
      </div>
    </div>
  );
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

function AcceptedClosureTurnCard({ phase, summary }: { phase: WorkflowPhase; summary: string }) {
  return (
    <WorkspaceStateCard
      eyebrow="Phase closure confirmed"
      title={`${getWorkflowPhaseLabel(phase)} closure confirmed`}
      description={summary}
    />
  );
}

function AnsweredTurnCard({
  turn,
  captureStatus,
}: {
  turn: ProjectStateTurn;
  captureStatus?: 'waiting' | 'applying';
}) {
  const persistedResponse = getPersistedTurnResponse(turn);
  const selectedOptionContents =
    turn.options
      ?.filter((option) => persistedResponse?.selectedOptionIds.includes(option.id))
      .map((option) => option.content) ?? [];
  const selectionSummary =
    selectedOptionContents.length > 0
      ? selectedOptionContents.join(', ')
      : persistedResponse?.freeText
        ? 'None of the above'
        : turn.answer?.trim() || 'Awaiting response';
  const responseContext =
    persistedResponse?.freeText?.trim() || turn.answer?.trim() || 'No additional context provided.';
  const assistantParts = safeParsePersistedAssistantParts(turn.assistant_parts);
  const hasReasoning = assistantParts.some((part) => part.type === 'reasoning');
  const hasObserverResult = assistantParts.some((part) => part.type === 'data-observer-result');
  const capturedItems = turn.captured_items ?? [];

  return (
    <div className="my-3 rounded-xl border bg-card p-4 shadow-sm" data-testid="answered-turn-card">
      {hasReasoning ? <p className="mb-2 text-sm italic text-muted-foreground">Thinking…</p> : null}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{getWorkflowPhaseLabel(turn.phase)}</span>
            {turn.impact ? (
              <span className={cn('rounded px-2 py-0.5 uppercase', impactStyles[turn.impact])}>
                {turn.impact} impact
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-foreground">{turn.question}</h3>
        </div>
        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Done</span>
      </div>

      <div className="mt-4 grid gap-3 border-t pt-3 text-sm md:grid-cols-[minmax(0,1fr),minmax(0,2fr)]">
        <div>
          <p className="font-medium text-muted-foreground">Chosen</p>
          <p className="mt-1 text-foreground">{selectionSummary}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Context</p>
          <p className="mt-1 text-foreground">{responseContext}</p>
        </div>
      </div>

      <div className="mt-4 border-t pt-3 text-sm">
        <p className="font-medium text-muted-foreground">Captured</p>
        {capturedItems.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {capturedItems.map((item) => (
              <li key={`${item.collection}:${item.id}`} className="rounded-md border bg-background px-3 py-2">
                {item.referenceCode ? (
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.referenceCode}
                  </p>
                ) : null}
                <p className="mt-1 text-foreground">{item.content}</p>
              </li>
            ))}
          </ul>
        ) : captureStatus === 'applying' ? (
          <p className="mt-1 text-foreground">Applying captured knowledge to this answer…</p>
        ) : captureStatus === 'waiting' ? (
          <p className="mt-1 text-foreground">Capturing knowledge from this answer…</p>
        ) : (
          <p className="mt-1 text-foreground">
            {hasObserverResult ? 'Workspace knowledge updated from this answer.' : 'Still thinking…'}
          </p>
        )}
      </div>
    </div>
  );
}

function getQuestionDetail(part: AskQuestionUIPart) {
  switch (part.state) {
    case 'input-available':
    case 'approval-requested':
    case 'approval-responded':
    case 'output-available':
    case 'output-denied':
      return part.input.question;
    case 'output-error':
      return part.input?.question ?? null;
    case 'input-streaming':
      return null;
  }
}

function renderParts(
  message: BrunchUIMessage,
  isStreaming: boolean,
  options?: { suppressStructuredQuestion?: boolean; suppressPhaseSummary?: boolean },
) {
  return message.parts?.map((part, index) => {
    if (part.type === 'reasoning') {
      if (isStreaming && index === message.parts.length - 1) {
        return (
          <Reasoning key={index} isStreaming>
            <ReasoningTrigger />
            <ReasoningContent>{part.text}</ReasoningContent>
          </Reasoning>
        );
      }

      return <TranscriptMetaPlaceholder key={index} label="Reasoning shown live" />;
    }
    if (part.type === 'step-start') {
      return null;
    }
    if (isAskQuestionUIPart(part)) {
      if (isStreaming || options?.suppressStructuredQuestion) {
        return null;
      }

      return (
        <TranscriptMetaPlaceholder
          key={index}
          testId="structured-question-placeholder"
          label="Structured interview question"
          detail={getQuestionDetail(part)}
        />
      );
    }
    if (part.type === 'tool-propose_phase_closure') {
      return (
        <TranscriptMetaPlaceholder
          key={index}
          label="Phase closure proposal"
          detail={part.input?.summary ?? 'A closure recommendation was prepared for this phase.'}
        />
      );
    }
    if (part.type === 'data-observer-result') {
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
      return (
        <Tool key={index} defaultOpen={part.state === 'output-available' || part.state === 'output-error'}>
          <ToolHeader type={part.type} state={part.state} toolName={part.toolName} />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolOutput output={part.output} errorText={part.errorText} />
          </ToolContent>
        </Tool>
      );
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
    turnCard,
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
    turnCard?.kind === 'pending-question' ||
    (turnCard?.kind === 'persisted-turn' && !turnHasCompletedAnswer(turnCard.turn));
  const renderedPersistedTurnId =
    turnCard?.kind === 'persisted-turn' &&
    (!turnHasCompletedAnswer(turnCard.turn) || turnCard.state === 'submitted')
      ? turnCard.turn.id
      : null;
  const completedPhaseItems = phaseTurns.reduce<
    Array<
      | { kind: 'answered-turn'; turn: ProjectStateTurn }
      | {
          kind: 'accepted-closure';
          acceptedClosure: NonNullable<ReturnType<typeof getAcceptedClosureReplay>>;
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
      items.push({ kind: 'answered-turn', turn });
    }

    return items;
  }, []);
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
  const reviewSet =
    phase === 'requirements'
      ? {
          title: 'Current requirement set',
          items: entitySnapshot.requirements,
        }
      : phase === 'criteria'
        ? {
            title: 'Current criterion set',
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
  const showClosePhaseAction = phaseState.status === 'in_progress' && phaseState.closeability;
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
            to={`/project/$id/${phaseRouteSegments[nextPhase!]}` as '/project/$id/framing'}
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
        <div className="flex flex-col gap-8 mx-auto max-w-2xl px-4 py-3">
          {showLockedState && currentReachablePhase && (
            <WorkspaceStateCard
              eyebrow="Locked phase"
              title={`${getWorkflowPhaseLabel(phase)} phase is not available yet`}
              description={`Finish or enter ${getWorkflowPhaseLabel(currentReachablePhase)} before opening this phase.`}
            >
              <Link
                to={`/project/$id/${phaseRouteSegments[currentReachablePhase]}` as '/project/$id/framing'}
                params={{ id: String(project.id) }}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                Go to {getWorkflowPhaseLabel(currentReachablePhase)}
              </Link>
            </WorkspaceStateCard>
          )}

          {isReviewPhase(phase) && phaseState.status === 'in_progress' && <ReviewPhaseBanner phase={phase} />}

          {completedPhaseItems.map((item) =>
            item.kind === 'answered-turn' ? (
              <AnsweredTurnCard
                key={`answered-turn-${item.turn.id}`}
                turn={item.turn}
                captureStatus={captureStatusByTurnId.get(item.turn.id)}
              />
            ) : (
              <div
                key={`accepted-closure-${item.acceptedClosure.turnId}`}
                data-testid="accepted-closure-turn-card"
              >
                <AcceptedClosureTurnCard
                  phase={item.acceptedClosure.phase}
                  summary={item.acceptedClosure.summary}
                />
              </div>
            ),
          )}

          {chat.messages.map((message, messageIndex) => {
            if (/^turn-\d+-/.test(message.id)) {
              return null;
            }

            const isLastAssistant = message.role === 'assistant' && messageIndex === chat.messages.length - 1;
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

            return (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {renderParts(message, isLastAssistant && chat.isStreaming, { suppressPhaseSummary })}
                </MessageContent>
              </Message>
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

          {turnCard?.kind === 'persisted-turn' &&
            (!turnHasCompletedAnswer(turnCard.turn) || turnCard.state === 'submitted') && (
              <TurnCard
                key={`persisted-turn-${turnCard.turn.id}`}
                id={`persisted-turn-${turnCard.turn.id}`}
                question={turnCard.turn.question}
                why={turnCard.turn.why}
                impact={turnCard.turn.impact}
                options={turnCard.turn.options ?? []}
                onSubmitResponse={turnCard.submitTurnResponse}
                persistedSelectedPositions={getPersistedSelectedPositions(turnCard.turn)}
                persistedFreeText={getPersistedTurnResponse(turnCard.turn)?.freeText?.trim() ?? ''}
                hasPersistedResponse={turnCard.state === 'submitted' && turnHasCompletedAnswer(turnCard.turn)}
                disabled={turnCard.disabled}
                state={turnCard.state}
                reviewSet={reviewSet}
              />
            )}

          {turnCard?.kind === 'pending-question' && (
            <TurnCard
              key={turnCard.pendingQuestion.id}
              id={turnCard.pendingQuestion.id}
              question={turnCard.pendingQuestion.question}
              why={turnCard.pendingQuestion.why}
              impact={turnCard.pendingQuestion.impact}
              options={turnCard.pendingQuestion.options}
              persistedSelectedPositions={[]}
              persistedFreeText=""
              hasPersistedResponse={false}
              disabled={turnCard.disabled}
              state="active"
              reviewSet={reviewSet}
            />
          )}

          {turnCard?.kind === 'kickoff' && !showLockedState && (
            <KickoffTurnCard
              phase={turnCard.kickoff.phase}
              mode={turnCard.kickoff.mode}
              onProceed={() => turnCard.submitKickoff()}
              onSelectStrategy={(mode) => turnCard.submitKickoff(mode)}
              disabled={turnCard.disabled}
            />
          )}

          {turnCard?.kind === 'recovery' && !showLockedState && (
            <RecoveryTurnCard
              phase={turnCard.recovery.phase}
              onRecover={turnCard.submitRecovery}
              disabled={turnCard.disabled}
            />
          )}

          {turnCard?.kind === 'persisted-turn' && turnCard.errorMessage && (
            <p role="alert" className="mx-auto mt-3 max-w-2xl text-sm text-destructive">
              {turnCard.errorMessage}
            </p>
          )}

          {phaseSummary && (
            <PhaseSummaryCard
              phase={phaseSummary.phase}
              summary={phaseSummary.summary}
              disabled={chat.isLoading}
              onConfirm={() => chat.confirmPhaseClosure(phaseSummary.phase, phaseSummary.turnId)}
            />
          )}

          {showGeneratingState && (
            <WorkspaceStateCard
              eyebrow="In progress"
              title={`Preparing the next ${isReviewPhase(phase) ? 'review step' : 'interview turn'}`}
              description="The workspace is waiting on the interviewer before the next step can be answered."
            />
          )}

          {showClosedState && (
            <WorkspaceStateCard
              eyebrow={showCompletionState ? 'Workflow complete' : 'Phase handoff'}
              title={
                showCompletionState
                  ? 'The interview workspace is complete'
                  : `${getWorkflowPhaseLabel(phase)} phase is complete`
              }
              description={
                phaseState.summary ??
                (showCompletionState
                  ? 'All phases are closed. Review the export to inspect the current structured spec output.'
                  : 'This phase has been closed and handed off to the next phase.')
              }
            >
              {showCompletionState ? (
                <Link
                  to="/project/$id/export"
                  params={{ id: String(project.id) }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  Open export preview
                </Link>
              ) : nextPhase ? (
                <Link
                  to={`/project/$id/${phaseRouteSegments[nextPhase]}` as '/project/$id/framing'}
                  params={{ id: String(project.id) }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  Continue to {getWorkflowPhaseLabel(nextPhase)}
                </Link>
              ) : null}
            </WorkspaceStateCard>
          )}
        </div>
      </ChatScroll>

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
