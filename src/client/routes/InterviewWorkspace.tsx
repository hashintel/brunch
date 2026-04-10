import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { EntitySidebar } from '@/components/EntitySidebar';
import { cn } from '@/lib/utils';

import type { ProjectState, ProjectStateTurn } from '../../shared/api-types.js';
import { isAskQuestionUIPart, type BrunchUIMessage } from '../../shared/chat.js';
import { getForceClosePhaseAction, getPhaseClosureCommandText } from '../../shared/phase-close.js';
import { useWorkspaceController } from '../workspace/workspace-controller';
import {
  getPersistedSelectedPositions,
  hasPersistedTurnResponse,
} from '../workspace/workspace-controller-core';

const impactStyles: Record<string, string> = {
  high: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  medium: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  low: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
};

type TurnCardOption = Pick<
  NonNullable<ProjectStateTurn['options']>[number],
  'position' | 'content' | 'is_recommended'
>;

type WorkflowPhaseState = ProjectState['workflow']['phases'][ProjectStateTurn['phase']];

function getWorkflowStatusLabel(phase: ProjectStateTurn['phase'], state: WorkflowPhaseState) {
  const phaseLabel = phase[0].toUpperCase() + phase.slice(1);
  if (state.status === 'closed') {
    return `${phaseLabel} closed`;
  }
  if (state.proposalPending) {
    return `${phaseLabel} ready to confirm`;
  }
  if (state.status === 'unstarted') {
    return `${phaseLabel} not started`;
  }
  return `${phaseLabel} in progress`;
}

function getWorkflowMetaLabel(state: WorkflowPhaseState) {
  const parts = [`${state.readiness[0].toUpperCase() + state.readiness.slice(1)} readiness`];
  if (state.status !== 'closed') {
    parts.push(state.closeability ? 'Closeable now' : 'Not yet closeable');
  }
  if (state.closureBasis === 'interviewer_recommended') {
    parts.push('Recommended close');
  }
  if (state.closureBasis === 'user_forced') {
    parts.push('Forced close');
  }
  return parts.join(' · ');
}

function canForceClosePhase(workflow: ProjectState['workflow'], phase: ProjectStateTurn['phase']) {
  return getForceClosePhaseAction(workflow, phase).available;
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
      <div className="mb-2 text-[15px] font-semibold">
        {phase[0].toUpperCase() + phase.slice(1)} closure proposal
      </div>
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
  hasPersistedResponse,
  disabled,
}: {
  id: string;
  question: string;
  why: string | null;
  impact: ProjectStateTurn['impact'];
  options: TurnCardOption[];
  onSubmitResponse?: (positions: number[], freeText?: string) => void | Promise<void>;
  persistedSelectedPositions: number[];
  hasPersistedResponse: boolean;
  disabled: boolean;
}) {
  const [selectedPositions, setSelectedPositions] = useState<number[]>(persistedSelectedPositions);
  const [freeText, setFreeText] = useState('');
  const hasSelection = selectedPositions.length > 0;
  const hasFreeText = freeText.trim().length > 0;
  const isReadOnly = disabled || hasPersistedResponse;

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
        {options.map((opt) => {
          const isSelected = selectedPositions.includes(opt.position);
          return (
            <label
              key={opt.position}
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
                onChange={() => toggleSelection(opt.position)}
                disabled={isReadOnly}
                aria-label={opt.content}
              />
              <span>
                {opt.content}
                {opt.is_recommended && (
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

function renderParts(msg: BrunchUIMessage, isStreaming: boolean) {
  return msg.parts?.map((part, i) => {
    if (part.type === 'reasoning') {
      return (
        <Reasoning key={i} isStreaming={isStreaming && i === msg.parts.length - 1}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    }
    if (isAskQuestionUIPart(part)) {
      return null;
    }
    if (part.type === 'data-observer-result' || part.type === 'data-phase-summary') {
      return null;
    }
    if (part.type === 'dynamic-tool') {
      return (
        <Tool key={i} defaultOpen={part.state === 'output-available' || part.state === 'output-error'}>
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
        <MessageResponse key={i} isAnimating={isStreaming}>
          {part.text}
        </MessageResponse>
      );
    }
    return null;
  });
}

export function InterviewWorkspace() {
  const workspace = useWorkspaceController();
  const { chat, entityState, project, workflow, phaseSummary, promptInput, turnCard } = workspace;

  const handleSubmit = (message: PromptInputMessage) => {
    workspace.chat.submitText(message.text ?? '');
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Projects
        </Link>
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(workflow.phases) as Array<[ProjectStateTurn['phase'], WorkflowPhaseState]>).map(
            ([phase, state]) => (
              <div key={phase} className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">{getWorkflowStatusLabel(phase, state)}</div>
                <div>{getWorkflowMetaLabel(state)}</div>
                {canForceClosePhase(workflow, phase) && (
                  <button
                    type="button"
                    onClick={() => chat.forcePhaseClosure(phase)}
                    disabled={chat.isLoading}
                    className={cn(
                      'mt-2 rounded-md border px-2 py-1 text-xs transition-colors',
                      chat.isLoading
                        ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {getPhaseClosureCommandText({ kind: 'force-close-active-phase', phase })}
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto max-w-2xl">
              {chat.messages.map((msg, msgIdx) => {
                const isLastAssistant = msg.role === 'assistant' && msgIdx === chat.messages.length - 1;
                return (
                  <Message key={msg.id} from={msg.role}>
                    <MessageContent>
                      {msg.role === 'user'
                        ? msg.parts
                            ?.filter((p) => p.type === 'text')
                            .map((p, i) => <span key={i}>{p.text}</span>)
                        : renderParts(msg, isLastAssistant && chat.isStreaming)}
                    </MessageContent>
                  </Message>
                );
              })}

              {turnCard?.kind === 'persisted-turn' && (
                <TurnCard
                  key={`persisted-turn-${turnCard.turn.id}`}
                  id={`persisted-turn-${turnCard.turn.id}`}
                  question={turnCard.turn.question}
                  why={turnCard.turn.why}
                  impact={turnCard.turn.impact}
                  options={turnCard.turn.options ?? []}
                  onSubmitResponse={turnCard.submitTurnResponse}
                  persistedSelectedPositions={getPersistedSelectedPositions(turnCard.turn)}
                  hasPersistedResponse={hasPersistedTurnResponse(turnCard.turn)}
                  disabled={turnCard.disabled}
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
                  hasPersistedResponse={false}
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
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {promptInput.visible && (
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

        <EntitySidebar entityState={entityState} />
      </div>
    </div>
  );
}
