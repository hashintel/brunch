import { useChat } from '@ai-sdk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLoaderData, useParams, Link, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useMemo, useCallback } from 'react';

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

import type { ProjectStateTurn } from '../../shared/api-types.js';
import {
  assistantPartsSchema,
  brunchDataPartSchemas,
  isAskQuestionUIPart,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type BrunchUserPart,
  userPartsSchema,
} from '../../shared/chat.js';

function parseAssistantParts(json: string | null): BrunchAssistantPart[] {
  if (!json) return [];
  try {
    return assistantPartsSchema.parse(JSON.parse(json)) as BrunchAssistantPart[];
  } catch {
    return [];
  }
}

function parseUserParts(json: string | null): BrunchUserPart[] {
  if (!json) return [];
  try {
    return userPartsSchema.parse(JSON.parse(json));
  } catch {
    return [];
  }
}

function hydrateMessages(turns: ProjectStateTurn[]): BrunchUIMessage[] {
  const msgs: BrunchUIMessage[] = [];
  for (const turn of turns) {
    const hydratedUserParts = parseUserParts(turn.user_parts);
    const userParts =
      hydratedUserParts.length > 0
        ? hydratedUserParts.some((part) => part.type === 'text') || !turn.answer
          ? hydratedUserParts
          : ([{ type: 'text', text: turn.answer }, ...hydratedUserParts] as BrunchUserPart[])
        : turn.answer
          ? ([{ type: 'text', text: turn.answer }] as BrunchUserPart[])
          : [];

    if (userParts.length > 0) {
      msgs.push({
        id: `turn-${turn.id}-answer`,
        role: 'user',
        parts: userParts,
      });
    }

    const assistantParts = parseAssistantParts(turn.assistant_parts);
    if (assistantParts.length > 0) {
      msgs.push({ id: `turn-${turn.id}-assistant`, role: 'assistant', parts: assistantParts });
      continue;
    }

    if (turn.question) {
      msgs.push({
        id: `turn-${turn.id}-assistant`,
        role: 'assistant',
        parts: [{ type: 'text' as const, text: turn.question }],
      });
    }
  }
  return msgs;
}

const impactStyles: Record<string, string> = {
  high: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  medium: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  low: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
};

function TurnCard({
  turn,
  onSelect,
  disabled,
}: {
  turn: ProjectStateTurn;
  onSelect: (turnId: number, position: number) => void;
  disabled: boolean;
}) {
  const options = turn.options ?? [];
  const hasSelection = options.some((o) => o.is_selected);

  return (
    <div className="my-3 rounded-lg border bg-card p-4">
      <div className="mb-2 text-[15px] font-semibold">{turn.question}</div>

      {turn.why && <div className="mb-2 text-[13px] italic text-muted-foreground">{turn.why}</div>}

      {turn.impact && (
        <span
          className={cn(
            'mb-2 inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase',
            impactStyles[turn.impact] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {turn.impact} impact
        </span>
      )}

      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((opt) => {
          const isSelected = opt.is_selected;
          return (
            <button
              key={opt.position}
              type="button"
              disabled={disabled || hasSelection}
              onClick={() => onSelect(turn.id, opt.position)}
              className={cn(
                'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-border bg-background hover:bg-muted',
                hasSelection && !isSelected && 'opacity-50',
              )}
            >
              {opt.content}
              {opt.is_recommended && (
                <span className="ml-2 text-[11px] font-semibold text-primary">Recommended</span>
              )}
              {isSelected && (
                <span className="ml-2 text-[11px] font-semibold text-green-600">✓ Selected</span>
              )}
            </button>
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
  const { project, turns } = useLoaderData({ from: '/project/$id' });
  const { id } = useParams({ from: '/project/$id' });
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);

  const queryClient = useQueryClient();
  const initialMessages = useMemo(() => hydrateMessages(turns), [project.id]);
  const transport = useMemo(() => new DefaultChatTransport({ api: `/api/projects/${id}/chat` }), [id]);
  const { messages, sendMessage, setMessages, status } = useChat<BrunchUIMessage>({
    transport,
    messages: initialMessages,
    dataPartSchemas: brunchDataPartSchemas,
    onData: (dataPart) => {
      if (dataPart.type === 'data-observer-result') {
        void queryClient.invalidateQueries({ queryKey: ['entities', Number(id)] });
      }
    },
    onFinish: () => {
      void router.invalidate();
    },
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    setMessages(hydrateMessages(turns));
  }, [project.id, setMessages]);

  const lastTurn = turns[turns.length - 1] as ProjectStateTurn | undefined;
  const showTurnCard = lastTurn?.options?.length && lastTurn.options.length > 0;
  const lastTurnHasSelection = lastTurn?.options?.some((o) => o.is_selected) ?? false;

  const handleSelect = useCallback(
    async (turnId: number, position: number) => {
      setSelecting(true);
      try {
        const res = await fetch(`/api/projects/${id}/turns/${turnId}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position }),
        });
        if (!res.ok) return;

        const options = lastTurn?.options ?? [];
        const selected = options.find((o) => o.position === position);
        if (selected) {
          await router.invalidate();
          void sendMessage({ text: selected.content });
        }
      } finally {
        setSelecting(false);
      }
    },
    [id, lastTurn, router, sendMessage],
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text?.trim() || isLoading) return;
      void sendMessage({ text: message.text });
    },
    [isLoading, sendMessage],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Projects
        </Link>
        <h1 className="text-lg font-semibold">{project.name}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto max-w-2xl">
              {messages.map((msg, msgIdx) => {
                const isLastAssistant = msg.role === 'assistant' && msgIdx === messages.length - 1;
                return (
                  <Message key={msg.id} from={msg.role}>
                    <MessageContent>
                      {msg.role === 'user'
                        ? msg.parts
                            ?.filter((p) => p.type === 'text')
                            .map((p, i) => <span key={i}>{p.text}</span>)
                        : renderParts(msg, isLastAssistant && status === 'streaming')}
                    </MessageContent>
                  </Message>
                );
              })}

              {showTurnCard && !isLoading && (
                <TurnCard turn={lastTurn!} onSelect={handleSelect} disabled={selecting || isLoading} />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {(!showTurnCard || lastTurnHasSelection) && (
            <div className="border-t px-4 py-3">
              <div className="mx-auto max-w-2xl">
                <PromptInput onSubmit={handleSubmit}>
                  <PromptInputBody>
                    <PromptInputTextarea placeholder="Type a message..." disabled={isLoading || selecting} />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputSubmit status={status} />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          )}
        </div>

        <EntitySidebar projectId={Number(id)} />
      </div>
    </div>
  );
}
