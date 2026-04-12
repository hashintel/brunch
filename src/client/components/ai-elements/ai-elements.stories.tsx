import type { Story, StoryDefault } from '@ladle/react';
import { useState, useCallback } from 'react';

import { Badge } from '@/client/components/ui/badge';
import { Card, CardContent } from '@/client/components/ui/card';
import type { BrunchUIMessage } from '@/shared/chat.js';

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContainer,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from './code-block';
import { Conversation, ConversationContent, ConversationScrollButton } from './conversation';
import { Message, MessageContent, MessageResponse } from './message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from './prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from './reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from './tool';

export default {
  title: 'AI Elements',
} satisfies StoryDefault;

// ── Fixture data ────────────────────────────────────────────────────

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

// ── Conversation + Messages ─────────────────────────────────────────

export const ConversationDemo: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Conversation + Message + Reasoning + Tool</h2>
      <Card>
        <CardContent>
          <div className="flex flex-col gap-6 py-4">
            {FIXTURE_MESSAGES.map((msg) => (
              <Message key={msg.id} from={msg.role}>
                <MessageContent>
                  {msg.parts.map((part: (typeof msg.parts)[number], i: number) => {
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
    </div>
  );
};

// ── Tool States ─────────────────────────────────────────────────────

export const ToolStates: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Tool states</h2>
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
    </div>
  );
};

// ── Code Block (with shiki highlighting) ────────────────────────────

export const CodeBlockDemo: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">CodeBlock (stories only — not in production bundle)</h2>
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
  );
};

// ── Prompt Input ────────────────────────────────────────────────────

export const PromptInputDemo: Story = () => {
  const [submitted, setSubmitted] = useState<string[]>([]);

  const handleSubmit = useCallback((message: PromptInputMessage) => {
    if (message.text?.trim()) {
      setSubmitted((prev) => [...prev, message.text]);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">PromptInput</h2>
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
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Submitted messages:</p>
          {submitted.map((text, i) => (
            <div key={i} className="rounded border bg-muted/50 px-3 py-1.5 text-sm">
              {text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Conversation Scroll ─────────────────────────────────────────────

export const ConversationScroll: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Conversation scroll container</h2>
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
    </div>
  );
};

// ── Badges (shadcn) ─────────────────────────────────────────────────

export const BadgeVariants: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Badge variants</h2>
      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    </div>
  );
};
