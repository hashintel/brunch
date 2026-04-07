import { Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContainer,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
} from '@/components/ai-elements/code-block';
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
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { BrunchUIMessage } from '../../shared/chat.js';

const FIXTURE_MESSAGES: BrunchUIMessage[] = [
  {
    id: 'debug-1',
    role: 'user',
    parts: [{ type: 'text', text: 'What architecture should we use for the event system?' }],
  },
  {
    id: 'debug-2',
    role: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: 'The user is asking about event architecture. Let me consider the tradeoffs between pub/sub, event sourcing, and a simple observer pattern given the requirements for a spec elicitation tool.\n\nKey considerations:\n- Need to track entity changes (decisions, assumptions)\n- Must support undo/branching via turn tree\n- Should emit events that SSE can forward to the client',
      },
      {
        type: 'text',
        text: "Based on the project requirements, I'd recommend a **domain event** pattern with these characteristics:\n\n1. **Core yields `AsyncIterable<DomainEvent>`** — the interview engine produces a stream of typed events\n2. **SSE adapter consumes events** — translates domain events to SSE format for the client\n3. **Events are post-commit** — fired after the database transaction succeeds\n\nThis gives you a clean separation between the interview logic and transport. The `conductTurn()` function becomes the single entry point, and everything downstream reacts to its event stream.",
      },
    ],
  },
  {
    id: 'debug-3',
    role: 'user',
    parts: [{ type: 'text', text: 'That sounds good. Can you show me how the tool calls would look?' }],
  },
  {
    id: 'debug-4',
    role: 'assistant',
    parts: [
      {
        type: 'tool-ask_question',
        toolCallId: 'debug-tool-1',
        state: 'output-available',
        input: {
          question: 'What concurrency model should the event system use?',
          why: 'This determines how multiple observers can process events without blocking the main interview flow.',
          impact: 'high',
          options: [
            { content: 'Single-threaded with async/await', is_recommended: true },
            { content: 'Worker threads for heavy extraction', is_recommended: false },
            { content: 'Queue-based with retry semantics', is_recommended: false },
          ],
        },
        output: {
          ok: true,
          turnId: 42,
          optionCount: 3,
        },
      },
      {
        type: 'text',
        text: "Here's how the structured question tool appears on the AI SDK-native stream before the workspace renders the matching turn card.",
      },
    ],
  },
];

const FIXTURE_CODE = `const stream = createUIMessageStream<BrunchUIMessage>({
  async execute({ writer }) {
    writer.merge(
      interviewer.toUIMessageStream({
        sendReasoning: true,
        sendFinish: false,
      }),
    );

    const entityIds = await runObserver(db, persistedTurn, projectId);
    writer.write({ type: 'data-observer-result', data: { entityIds } });
    writer.write({ type: 'finish', finishReason: 'stop' });
  },
}`;

const impactStyles: Record<string, string> = {
  high: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  medium: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  low: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">{title}</h2>
      <Separator />
      {children}
    </div>
  );
}

export function ComponentDebug() {
  const [submitted, setSubmitted] = useState<string[]>([]);

  const handleSubmit = useCallback((message: PromptInputMessage) => {
    if (message.text?.trim()) {
      setSubmitted((prev) => [...prev, message.text]);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <h1 className="text-lg font-semibold">Component Debug</h1>
        <Badge variant="outline">outer-loop testing</Badge>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-12 p-8">
          {/* ---- Conversation + Messages ---- */}
          <Section title="Conversation + Message + Reasoning + Tool">
            <Card>
              <CardContent>
                <div className="flex flex-col gap-6 py-4">
                  {FIXTURE_MESSAGES.map((msg) => (
                    <Message key={msg.id} from={msg.role}>
                      <MessageContent>
                        {msg.parts.map((part, i) => {
                          if (part.type === 'reasoning') {
                            return (
                              <Reasoning key={i} defaultOpen>
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          }
                          if (part.type === 'tool-ask_question') {
                            return (
                              <Tool key={i} defaultOpen>
                                <ToolHeader type={part.type} state={part.state} />
                                <ToolContent>
                                  <ToolInput input={part.input} />
                                  <ToolOutput output={part.output} errorText={part.errorText} />
                                </ToolContent>
                              </Tool>
                            );
                          }
                          if (part.type === 'text') {
                            return <MessageResponse key={i}>{part.text}</MessageResponse>;
                          }
                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Section>

          {/* ---- Tool States ---- */}
          <Section title="Tool States">
            <div className="space-y-3">
              {(
                [
                  'input-streaming',
                  'input-available',
                  'output-available',
                  'output-error',
                  'approval-requested',
                  'approval-responded',
                  'output-denied',
                ] as const
              ).map((state) => (
                <Tool key={state}>
                  <ToolHeader type="tool-ask_question" state={state} title={`ask_question (${state})`} />
                </Tool>
              ))}
            </div>
          </Section>

          {/* ---- Code Block ---- */}
          <Section title="CodeBlock">
            <CodeBlock code={FIXTURE_CODE} language="typescript">
              <CodeBlockHeader>
                <CodeBlockTitle>
                  <CodeBlockFilename>core.ts</CodeBlockFilename>
                </CodeBlockTitle>
                <CodeBlockActions>
                  <CodeBlockCopyButton />
                </CodeBlockActions>
              </CodeBlockHeader>
            </CodeBlock>

            <div className="mt-4">
              <CodeBlockContainer language="json">
                <CodeBlockHeader>
                  <CodeBlockTitle>
                    <CodeBlockFilename>domain-event.json</CodeBlockFilename>
                  </CodeBlockTitle>
                </CodeBlockHeader>
                <CodeBlockContent
                  code={JSON.stringify(
                    { type: 'entity-extracted', entity: { kind: 'decision', content: 'Use domain events' } },
                    null,
                    2,
                  )}
                  language="json"
                />
              </CodeBlockContainer>
            </div>
          </Section>

          {/* ---- Turn Card (from InterviewWorkspace) ---- */}
          <Section title="Turn Card">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 text-[15px] font-semibold">
                What concurrency model should the event system use?
              </div>
              <div className="mb-2 text-[13px] italic text-muted-foreground">
                This determines how multiple observers can process events without blocking the main interview
                flow.
              </div>
              <span
                className={cn(
                  'mb-2 inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase',
                  impactStyles.high,
                )}
              >
                high impact
              </span>
              <div className="mt-2 flex flex-col gap-1.5">
                {[
                  'Single-threaded with async/await',
                  'Worker threads for heavy extraction',
                  'Queue-based with retry semantics',
                ].map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      i === 0
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-border bg-background hover:bg-muted',
                      i === 0 ? '' : 'opacity-50',
                    )}
                  >
                    {opt}
                    {i === 0 && (
                      <span className="ml-2 text-[11px] font-semibold text-primary">Recommended</span>
                    )}
                    {i === 0 && (
                      <span className="ml-2 text-[11px] font-semibold text-green-600">✓ Selected</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ---- Prompt Input ---- */}
          <Section title="PromptInput">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea placeholder="Type something and press Enter..." />
              </PromptInputBody>
              <PromptInputFooter>
                <div />
                <PromptInputSubmit />
              </PromptInputFooter>
            </PromptInput>

            {submitted.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Submitted messages:</p>
                {submitted.map((text, i) => (
                  <div key={i} className="rounded border bg-muted/50 px-3 py-1.5 text-sm">
                    {text}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ---- Badges ---- */}
          <Section title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </Section>

          {/* ---- Buttons ---- */}
          <Section title="Buttons">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="xs">XS</Button>
              <Button size="sm">SM</Button>
              <Button size="default">Default</Button>
              <Button size="lg">LG</Button>
            </div>
          </Section>

          {/* ---- Conversation (scrollable) ---- */}
          <Section title="Conversation (scroll container)">
            <div className="h-64 rounded-lg border">
              <Conversation>
                <ConversationContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Message key={i} from={i % 2 === 0 ? 'user' : 'assistant'}>
                      <MessageContent>
                        {i % 2 === 0 ? (
                          <span>Message #{i + 1} from user</span>
                        ) : (
                          <MessageResponse>
                            {`Response **#${i + 1}** with some \`inline code\` and a longer paragraph to test wrapping behavior in the conversation container.`}
                          </MessageResponse>
                        )}
                      </MessageContent>
                    </Message>
                  ))}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
