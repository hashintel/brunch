import { Link } from '@tanstack/react-router';
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
import { cn } from '@/client/lib/utils';
import type { Impact, ProjectState, ProjectStateTurn, WorkflowPhase } from '@/shared/api-types.js';
import { isAskQuestionUIPart } from '@/shared/chat.js';
import type { AskQuestionUIPart, BrunchUIMessage } from '@/shared/chat.js';
import { getForceClosePhaseAction, getPhaseClosureCommandText } from '@/shared/phase-close.js';
import { getWorkflowPhaseLabel } from '@/shared/phase-display.js';
import { getNextActivePhase, phaseOrder, phaseRouteSegments } from '@/shared/phase-routes.js';

import { useInterviewController } from './-interview-controller';
import {
  getPersistedSelectedPositions,
  getPersistedTurnResponse,
  turnHasCompletedAnswer,
} from './-interview-controller-core.js';

const impactStyles = {
  high: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  medium: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  low: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
} satisfies Record<Impact, string>;

type TurnCardOption = Pick<
  NonNullable<ProjectStateTurn['options']>[number],
  'position' | 'content' | 'is_recommended'
>;

function canForceClosePhase(workflow: ProjectState['workflow'], phase: ProjectStateTurn['phase']) {
  return getForceClosePhaseAction(workflow, phase).available;
}

const startPhaseMessages: Record<WorkflowPhase, string> = {
  scope: 'Begin the grounding phase.',
  design: 'Begin the elicitation phase.',
  requirements: 'Begin the requirements phase.',
  criteria: 'Begin the acceptance criteria phase.',
};

const continuePhaseMessages: Record<WorkflowPhase, string> = {
  scope: 'Continue the grounding phase.',
  design: 'Continue the elicitation phase.',
  requirements: 'Continue the requirements phase.',
  criteria: 'Continue the acceptance criteria phase.',
};

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
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="my-3 rounded-xl border bg-card p-4 shadow-sm" data-testid="workspace-state-card">
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

function TurnCard({
  id,
  question,
  why,
  impact,
  options,
  onSubmitResponse,
  persistedSelectedPositions,
  persistedFreeText,
  hasPersistedResponse,
  disabled,
  state,
}: {
  id: string;
  question: string;
  why: string | null;
  impact: ProjectStateTurn['impact'];
  options: readonly TurnCardOption[];
  onSubmitResponse?: (positions: number[], freeText?: string) => void | Promise<void>;
  persistedSelectedPositions: number[];
  persistedFreeText: string;
  hasPersistedResponse: boolean;
  disabled: boolean;
  state: 'active' | 'submitted';
}) {
  const [selectedPositions, setSelectedPositions] = useState<number[]>(persistedSelectedPositions);
  const [freeText, setFreeText] = useState(persistedFreeText);
  const hasSelection = selectedPositions.length > 0;
  const hasFreeText = freeText.trim().length > 0;
  const isSubmitted = state === 'submitted';
  const isReadOnly = disabled || hasPersistedResponse || isSubmitted;

  useEffect(() => {
    if (!hasPersistedResponse) {
      return;
    }

    setSelectedPositions(persistedSelectedPositions);
    setFreeText(persistedFreeText);
  }, [hasPersistedResponse, persistedFreeText, persistedSelectedPositions]);

  function toggleSelection(position: number) {
    if (isReadOnly) {
      return;
    }

    setSelectedPositions((current) =>
      current.includes(position) ? current.filter((value) => value !== position) : [...current, position],
    );
  }

  return (
    <div className="my-3 rounded-lg border bg-card p-4">
      <div className="mb-2 text-[15px] font-semibold">{question}</div>

      {why && <div className="mb-2 text-[13px] italic text-muted-foreground">{why}</div>}

      {impact && (
        <span
          className={cn(
            'mb-2 inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase',
            impactStyles[impact] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {impact} impact
        </span>
      )}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium" htmlFor={`turn-response-${id}`}>
          Additional response context
        </label>
        <textarea
          id={`turn-response-${id}`}
          aria-label="Additional response context"
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          disabled={isReadOnly}
          placeholder="Optional details to send with your selection, or required if no option fits"
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={isReadOnly || !hasSelection}
            onClick={() => onSubmitResponse?.(selectedPositions, freeText)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm transition-colors',
              isReadOnly || !hasSelection
                ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            Submit selected response
          </button>
          <button
            type="button"
            disabled={isReadOnly || hasSelection || !hasFreeText}
            onClick={() => onSubmitResponse?.([], freeText)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm transition-colors',
              isReadOnly || hasSelection || !hasFreeText
                ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            Submit free-text response
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {isSubmitted ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
            data-testid="turn-processing-state"
          >
            Interviewer is processing this response.
          </div>
        ) : null}
        {options.map((option) => {
          const isSelected = selectedPositions.includes(option.position);
          return (
            <label
              key={option.position}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-border bg-background hover:bg-muted',
                isReadOnly && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelection(option.position)}
                disabled={isReadOnly}
                aria-label={option.content}
              />
              <span>
                {option.content}
                {option.is_recommended && (
                  <span className="ml-2 text-[11px] font-semibold text-primary">Recommended</span>
                )}
                {isSelected && (
                  <span className="ml-2 text-[11px] font-semibold text-green-600">✓ Selected</span>
                )}
              </span>
            </label>
          );
        })}
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

function readAssistantParts(turn: Pick<ProjectStateTurn, 'assistant_parts'>) {
  if (!turn.assistant_parts) {
    return [] as Array<{ type: string; [key: string]: unknown }>;
  }

  try {
    return JSON.parse(turn.assistant_parts) as Array<{ type: string; [key: string]: unknown }>;
  } catch {
    return [] as Array<{ type: string; [key: string]: unknown }>;
  }
}

function readUserParts(turn: Pick<ProjectStateTurn, 'user_parts'>) {
  if (!turn.user_parts) {
    return [] as Array<{ type: string; text?: string; [key: string]: unknown }>;
  }

  try {
    return JSON.parse(turn.user_parts) as Array<{ type: string; text?: string; [key: string]: unknown }>;
  } catch {
    return [] as Array<{ type: string; text?: string; [key: string]: unknown }>;
  }
}

function turnIsControlOrClosureArtifact(
  turn: Pick<ProjectStateTurn, 'assistant_parts' | 'is_resolution' | 'user_parts'>,
) {
  if (turn.is_resolution) {
    return true;
  }

  const userParts = readUserParts(turn);
  if (userParts.some((part) => part.type === 'data-confirmation')) {
    return true;
  }

  const hasBootstrapControlText = userParts.some(
    (part) =>
      part.type === 'text' && typeof part.text === 'string' && getControlMarkerLabel(part.text) !== null,
  );
  if (hasBootstrapControlText) {
    return true;
  }

  const assistantParts = readAssistantParts(turn);
  return assistantParts.some(
    (part) => part.type === 'tool-propose_phase_closure' || part.type === 'data-phase-summary',
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
  const assistantParts = readAssistantParts(turn);
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
  const { chat, project, workflow, phaseTurns, phaseSummary, promptInput, turnCard, captureStatusByTurnId } =
    useInterviewController(phase);
  const phaseState = workflow.phases[phase];
  const autoPresentKeyRef = useRef<string | null>(null);
  const currentReachablePhase =
    phaseOrder.find((candidate) => workflow.phases[candidate].status !== 'closed') ?? null;
  const nextPhase = getNextActivePhase(workflow.phases, phase);
  const hasVisibleTurnCard = turnCard !== null;
  // TODO: re-enable when auto-present is restored
  const _hasVisibleActiveTurn =
    turnCard?.kind === 'pending-question' ||
    (turnCard?.kind === 'persisted-turn' && !turnHasCompletedAnswer(turnCard.turn));
  const renderedPersistedTurnId =
    turnCard?.kind === 'persisted-turn' &&
    (!turnHasCompletedAnswer(turnCard.turn) || turnCard.state === 'submitted')
      ? turnCard.turn.id
      : null;
  const completedPhaseTurns = phaseTurns.filter(
    (turn) =>
      turnHasCompletedAnswer(turn) &&
      !turnIsControlOrClosureArtifact(turn) &&
      turn.id !== renderedPersistedTurnId,
  );
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
  const showGeneratingState =
    !phaseSummary && (autoPresentCommand !== null || (chat.isLoading && !hasVisibleTurnCard));
  // TODO: prompt input is disabled while the phase-closure interaction model is being reworked.
  // The turn-card family owns user input; the generic composer will return when the
  // center-pane header controls phase start/continue lifecycle.
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

          {completedPhaseTurns.map((turn) => (
            <AnsweredTurnCard
              key={`answered-turn-${turn.id}`}
              turn={turn}
              captureStatus={captureStatusByTurnId.get(turn.id)}
            />
          ))}

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
