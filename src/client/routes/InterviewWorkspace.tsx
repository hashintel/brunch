import { useChat } from '@ai-sdk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLoaderData, useParams, Link, useRouter } from '@tanstack/react-router';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

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
import { Tool, ToolHeader, ToolContent, type ToolPart } from '@/components/ai-elements/tool';
import { EntitySidebar } from '@/components/EntitySidebar';
import { cn } from '@/lib/utils';

type LoaderTurn = {
  id: number;
  answer: string | null;
  question: string | null;
  why: string | null;
  impact: string | null;
  phase: string;
  user_parts: string | null;
  assistant_parts: string | null;
  options: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
};

function hydrateMessages(turns: LoaderTurn[]): UIMessage[] {
  const msgs: UIMessage[] = [];
  for (const turn of turns) {
    if (turn.answer) {
      msgs.push({
        id: `turn-${turn.id}-answer`,
        role: 'user',
        parts: [{ type: 'text' as const, text: turn.answer }],
      });
    }

    if (turn.assistant_parts) {
      try {
        const parts = JSON.parse(turn.assistant_parts);
        if (Array.isArray(parts) && parts.length > 0) {
          msgs.push({ id: `turn-${turn.id}-assistant`, role: 'assistant', parts });
          continue;
        }
      } catch {
        // fall through to scalar synthesis
      }
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
  turn: LoaderTurn;
  onSelect: (turnId: number, position: number) => void;
  disabled: boolean;
}) {
  const hasSelection = turn.options.some((o) => o.is_selected);

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
        {turn.options.map((opt) => {
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

function renderParts(msg: UIMessage, isStreaming: boolean) {
  return msg.parts?.map((part, i) => {
    if (part.type === 'reasoning') {
      return (
        <Reasoning key={i} isStreaming={isStreaming && i === msg.parts.length - 1}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    }
    if (part.type === 'tool-invocation' || part.type === 'dynamic-tool') {
      const toolPart = part as unknown as ToolPart & { toolName?: string };
      if (toolPart.toolName === 'ask_question') return null;
      const toolName = toolPart.toolName ?? (toolPart.type === 'dynamic-tool' ? 'unknown' : undefined);
      return (
        <Tool
          key={i}
          defaultOpen={toolPart.state === 'output-available' || toolPart.state === 'output-error'}
        >
          {toolPart.type === 'dynamic-tool' ? (
            <ToolHeader type="dynamic-tool" state={toolPart.state} toolName={toolName!} />
          ) : (
            <ToolHeader type={toolPart.type} state={toolPart.state} />
          )}
          <ToolContent />
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
  const transport = useMemo(() => new DefaultChatTransport({ api: `/api/projects/${id}/chat` }), [id]);
  const { messages, sendMessage, setMessages, status } = useChat({ transport });
  const isLoading = status === 'submitted' || status === 'streaming';
  const prevStatusRef = useRef(status);

  // Invalidate entities query when chat finishes (observer has persisted entities)
  useEffect(() => {
    if (prevStatusRef.current === 'streaming' && status === 'ready') {
      void queryClient.invalidateQueries({ queryKey: ['entities', Number(id)] });
    }
    prevStatusRef.current = status;
  }, [status, queryClient, id]);

  useEffect(() => {
    setMessages(hydrateMessages(turns));
  }, [project.id, turns]);

  const lastTurn = turns[turns.length - 1] as LoaderTurn | undefined;
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

        const selected = lastTurn?.options.find((o) => o.position === position);
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
