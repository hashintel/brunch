import type { Story, StoryDefault } from '@ladle/react';
import { ArrowDownIcon, Check, Loader2 } from 'lucide-react';
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { useCallback, useRef, useState } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';

import { ShellButton } from '@/client/components/app-shell';
import { DrawerCard } from '@/client/components/drawer-card';
import { Button } from '@/client/components/ui/button';
import { Checkbox } from '@/client/components/ui/checkbox';
import { ScrollBar } from '@/client/components/ui/scroll-area';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

export default {
  title: 'Patterns / Chat',
} satisfies StoryDefault;

// ── Types ───────────────────────────────────────────────────────────

type Impact = 'high' | 'medium' | 'low';

const impactColor: Record<Impact, string> = {
  high: 'text-[color:#e14640]',
  medium: 'text-[color:#d97706]',
  low: 'text-[color:#16a34a]',
};

// ── Activity placeholder ────────────────────────────────────────────

function ActivityPlaceholder({ seconds, tools }: { seconds?: number; tools?: string[] }) {
  return (
    <div className="flex items-center justify-between px-1 py-1.5">
      <span className="text-xs text-hint">{seconds != null ? `Thought for ${seconds}s` : 'Thinking…'}</span>
      {tools && tools.length > 0 && <span className="text-xs text-hint">Tools: {tools.join(', ')}</span>}
    </div>
  );
}

// ── Answered question card ───────────────────────────────────────────

interface AnsweredTurnData {
  questionCode: string;
  question: string;
  impact: Impact;
  chosen: string[];
  context: string | null;
  captured: string[] | null;
  captureStatus: 'done' | 'trailing';
}

function AnsweredQuestionCard({ data }: { data: AnsweredTurnData }) {
  const impact = data.impact;
  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-row text-[12px] items-center justify-between gap-2.5">
        <span className={cn('font-medium', impactColor[impact])}>
          {impact[0]!.toUpperCase() + impact.slice(1)} Impact
        </span>
        <button
          type="button"
          className="flex text-[#16a34a] h-5 gap-1 -m-0.5 px-2 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[rgba(22,163,106,0.1)]"
        >
          Answered
          <Check className="size-2.5" />
        </button>
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="shrink-0 text-sm-plus font-medium text-hint">{data.questionCode}</span>
        <p className="flex-1 text-sm-plus font-medium tracking-[-0.015em] text-ink">{data.question}</p>
      </div>
    </div>
  );

  const summary = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-sub">
        <span>
          <span className="font-medium text-ink">Chosen:</span> {data.chosen.join(', ')}
        </span>
        {data.context && (
          <>
            <span className="text-hint">|</span>
            <span className="truncate">
              <span className="font-medium text-ink">Context:</span>{' '}
              <span className="italic">
                "{data.context.length > 50 ? data.context.slice(0, 50) + '…' : data.context}"
              </span>
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-medium text-hint">Captured:</span>
        {data.captureStatus === 'trailing' ? (
          <span className="flex items-center gap-1 text-sub">
            <Loader2 className="size-3 animate-spin" />
            Still thinking…
          </span>
        ) : data.captured && data.captured.length > 0 ? (
          <span className="font-mono text-sub">{data.captured.join(', ')}</span>
        ) : (
          <span className="text-hint">—</span>
        )}
      </div>
    </div>
  );

  return <DrawerCard header={header} summary={summary} locked />;
}

// ── Active question card ────────────────────────────────────────────

interface QuestionOption {
  id: number;
  content: string;
  isRecommended?: boolean;
}

type Selection =
  | { mode: 'options'; values: number[]; rationale: string }
  | { mode: 'none'; rationale: string };

function ActiveQuestionCard({
  questionCode,
  question,
  impact,
  why,
  options,
}: {
  questionCode: string;
  question: string;
  impact: Impact;
  why: string;
  options: QuestionOption[];
}) {
  const [selection, setSelection] = useState<Selection>({
    mode: 'options',
    values: [],
    rationale: '',
  });

  const isNone = selection.mode === 'none';
  const selectedValues = isNone ? [] : selection.values;

  function toggleOption(id: number) {
    setSelection((prev) => {
      if (prev.mode === 'none') {
        return { mode: 'options', values: [id], rationale: prev.rationale };
      }
      const values = prev.values.includes(id) ? prev.values.filter((v) => v !== id) : [...prev.values, id];
      return { ...prev, values };
    });
  }

  function toggleNone() {
    setSelection((prev) => {
      if (prev.mode === 'none') {
        return { mode: 'options', values: [], rationale: prev.rationale };
      }
      return { mode: 'none', rationale: prev.rationale };
    });
  }

  function setRationale(text: string) {
    setSelection((prev) => ({ ...prev, rationale: text }));
  }

  const header = (
    <div className="flex flex-col gap-1">
      <span className={cn('text-xs font-medium', impactColor[impact])}>
        {impact[0]!.toUpperCase() + impact.slice(1)} Impact
      </span>

      <div className="flex items-baseline gap-3 text-[17px] leading-[1.4]">
        <span className="shrink-0  font-medium text-hint">{questionCode}</span>
        <div className="flex flex-col gap-1">
          <p className="  font-medium tracking-[-0.015em] text-ink">{question}</p>
        </div>
      </div>
    </div>
  );

  const body = (
    <>
      <p className="text-xs leading-relaxed text-sub">{why}</p>

      <div className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={cn(
                'flex h-6 cursor-pointer items-center gap-2 rounded-lg text-left text-xs-plus',
                isNone && 'opacity-40',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleOption(opt.id)}
                className="data-checked:border-[#1060d6] data-checked:bg-[#2070e6]"
              />
              <span className={isSelected ? 'text-ink' : 'text-sub'}>{opt.content}</span>
              {opt.isRecommended && <span className="text-xxs font-medium text-[#2070e6]">Recommended</span>}
            </label>
          );
        })}

        <div className="my-1 border-t border-rule" />

        <label className="flex h-6 cursor-pointer items-center gap-2 rounded-lg text-left text-xs-plus">
          <Checkbox
            checked={isNone}
            onCheckedChange={toggleNone}
            className="data-checked:border-[#1060d6] data-checked:bg-[#2070e6]"
          />
          <span className={cn('text-sub', isNone && 'text-ink')}>None of the above / I'm not sure</span>
        </label>
      </div>

      <div className="-mx-4 -mb-4 border-t border-rule bg-white px-4 pt-3">
        <p className="text-xs text-sub">Please provide additional context for your answer.</p>
        <Textarea
          value={selection.rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Constraints, trade-offs, motivations, or reasoning worth capturing…"
          className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 pb-5 pt-2 text-sm-plus text-ink placeholder:text-hint focus-visible:ring-0"
        />
      </div>
    </>
  );

  return (
    <DrawerCard header={header} defaultExpanded locked>
      {body}
    </DrawerCard>
  );
}

// ── Fixture data ────────────────────────────────────────────────────

const answeredTurns: (AnsweredTurnData & { seconds: number; tools: string[] })[] = [
  {
    questionCode: 'Q1',
    question: 'What is the primary goal of this project?',
    impact: 'high',
    chosen: ['Structured spec elicitation'],
    context: 'We need to replace the ad-hoc interview notes with something repeatable.',
    captured: ['G1', 'G2', 'CTX1'],
    captureStatus: 'done',
    seconds: 4,
    tools: ['Read', 'Bash'],
  },
  {
    questionCode: 'Q2',
    question:
      'Should the system support real-time collaboration or is single-user sufficient for the initial release?',
    impact: 'high',
    chosen: ['Single-user for v1', 'Collaboration deferred to v2'],
    context: 'Multi-tenant adds too much complexity for the timeline we have.',
    captured: ['A1', 'A2', 'D1', 'CTX2'],
    captureStatus: 'done',
    seconds: 7,
    tools: ['Read', 'Bash'],
  },
  {
    questionCode: 'Q3',
    question: 'How should we persist data?',
    impact: 'medium',
    chosen: ['SQLite'],
    context: null,
    captured: ['D2', 'D3'],
    captureStatus: 'done',
    seconds: 3,
    tools: ['Read'],
  },
  {
    questionCode: 'Q4',
    question:
      'What does "category theory foundation" mean for the user experience, and does it imply frontend changes or is it purely a backend concern?',
    impact: 'high',
    chosen: ['New validation features exposed to users', 'Full UX redesign'],
    context: 'This really is an important architectural decision that affects every downstream team.',
    captured: ['A5', 'A6', 'D4', 'CR1', 'CR2'],
    captureStatus: 'done',
    seconds: 12,
    tools: ['Read', 'Grep'],
  },
  {
    questionCode: 'Q5',
    question: 'How should the system handle conflicting requirements across different stakeholder groups?',
    impact: 'medium',
    chosen: ['Flag conflicts for human resolution'],
    context: 'Auto-resolve felt too risky given the regulatory context.',
    captured: ['R1', 'R2'],
    captureStatus: 'done',
    seconds: 5,
    tools: ['Read', 'Bash'],
  },
  {
    questionCode: 'Q6',
    question: 'What level of backwards compatibility should the API maintain?',
    impact: 'low',
    chosen: ['Feature flags for gradual deprecation'],
    context: null,
    captured: ['D5'],
    captureStatus: 'done',
    seconds: 2,
    tools: ['Read'],
  },
  {
    questionCode: 'Q7',
    question: 'Should the notification system support real-time push, polling, or both?',
    impact: 'medium',
    chosen: ['WebSocket-based push', 'SSE fallback'],
    context: 'Enterprise environments sometimes block WebSocket connections.',
    captured: null,
    captureStatus: 'trailing',
    seconds: 8,
    tools: ['Read', 'Grep'],
  },
];

const activeQuestion = {
  questionCode: 'Q6',
  question:
    'A deeper question about that other thing we said earlier, which is really important but we haven’t fully unpacked yet.',
  impact: 'medium' as Impact,
  why: 'This is the meta explanation for why the interviewer is asking this question. It helps the user understand how to respond and what other context they might want to provide.',
  options: [
    { id: 1, content: 'Option A is kind of nice' },
    { id: 2, content: 'Option B might even be better' },
    { id: 3, content: 'Option C might be the best of both worlds' },
  ],
};

// ── Scroll container — ScrollArea + stick-to-bottom ─────────────────

function ChatScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const { scrollRef, contentRef, scrollToBottom, isAtBottom } = useStickToBottom({
    resize: 'smooth',
    initial: 'smooth',
  });

  // Merge our scrollRef with the ScrollArea viewport ref
  const viewportRef = useRef<HTMLDivElement>(null);
  const mergedViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      scrollRef(node);
    },
    [scrollRef],
  );

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)}>
      <ScrollAreaPrimitive.Viewport ref={mergedViewportRef} className="size-full rounded-[inherit]">
        <div ref={contentRef}>{children}</div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />

      {/* Scroll-to-bottom button */}
      {!isAtBottom && (
        <Button
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
          onClick={handleScrollToBottom}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDownIcon className="size-4" />
        </Button>
      )}
    </ScrollAreaPrimitive.Root>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export const Transcript: Story = () => {
  return (
    <div className="flex h-screen flex-col">
      <ChatScroll className="flex-1">
        <div className="flex flex-col gap-10 px-4 pt-6 pb-40">
          <div className="flex flex-col gap-6">
            {answeredTurns.map((turn) => (
              <div key={turn.questionCode} className="mx-auto flex w-full max-w-2xl flex-col">
                <ActivityPlaceholder seconds={turn.seconds} tools={turn.tools} />
                <AnsweredQuestionCard data={turn} />
              </div>
            ))}
          </div>

          <hr className="mt-1.5 border-rule" />

          {/* Active turn */}
          <div className="mx-auto flex w-full max-w-2xl flex-col">
            <ActivityPlaceholder />
            <ActiveQuestionCard {...activeQuestion} />
          </div>

          {/* Submission controls */}
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
            <ShellButton variant="ghost">Back</ShellButton>
            <div className="flex items-center gap-2">
              <ShellButton variant="ghost">Skip</ShellButton>
              <ShellButton variant="primary">Submit</ShellButton>
            </div>
          </div>
        </div>
      </ChatScroll>
    </div>
  );
};
