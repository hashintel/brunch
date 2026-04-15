import type { Story, StoryDefault } from '@ladle/react';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { ShellButton } from '@/client/components/app-shell';
import { DrawerCard } from '@/client/components/drawer-card';
import { Checkbox } from '@/client/components/ui/checkbox';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

export default {
  title: 'Patterns / Chat',
} satisfies StoryDefault;

// ── Types ───────────────────────────────────────────────────────────

type Impact = 'high' | 'medium' | 'low';

const impactColor: Record<Impact, string> = {
  high: 'text-[#e14640]',
  medium: 'text-[#d97706]',
  low: 'text-[#16a34a]',
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
  const header = (
    <div className="flex items-end gap-3">
      <span className="shrink-0 text-[17px] font-medium text-hint">{data.questionCode}</span>
      <div className="flex flex-1 flex-col gap-1">
        <span className={cn('text-xs font-medium', impactColor[data.impact])}>
          {data.impact[0]!.toUpperCase() + data.impact.slice(1)} Impact
        </span>
        <p className="truncate text-[17px] leading-snug font-medium tracking-[-0.015em] text-ink">
          {data.question}
        </p>
      </div>
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(22,163,106,0.1)]">
        <Check className="size-3.5 text-[#16a34a]" />
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
        {data.captureStatus === 'trailing' ?
          <span className="flex items-center gap-1 text-sub">
            <Loader2 className="size-3 animate-spin" />
            Still thinking…
          </span>
        : data.captured && data.captured.length > 0 ?
          <span className="font-mono text-sub">{data.captured.join(', ')}</span>
        : <span className="text-hint">—</span>}
      </div>
    </div>
  );

  return <DrawerCard header={header} summary={summary} />;
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
    <div className="flex items-end gap-3">
      <span className="shrink-0 text-[17px] font-medium text-hint">{questionCode}</span>
      <div className="flex flex-col gap-1">
        <span className={cn('text-xs font-medium', impactColor[impact])}>
          {impact[0]!.toUpperCase() + impact.slice(1)} Impact
        </span>
        <p className="text-[17px] leading-snug font-medium tracking-[-0.015em] text-ink">{question}</p>
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
              {opt.isRecommended && (
                <span className="text-xs-minus font-medium text-[#2070e6]">Recommended</span>
              )}
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
          className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 pb-5 pt-2 text-sm text-ink placeholder:text-hint focus-visible:ring-0"
        />
      </div>
    </>
  );

  return (
    <DrawerCard header={header} defaultExpanded>
      {body}
    </DrawerCard>
  );
}

// ── Fixture data ────────────────────────────────────────────────────

const answeredTurns: AnsweredTurnData[] = [
  {
    questionCode: 'Q4',
    question: 'A high level question about architecture…',
    impact: 'high',
    chosen: ['A', 'B'],
    context: 'This really is an important point…',
    captured: ['A5', 'A6', 'D2', 'C3', 'C4'],
    captureStatus: 'done',
  },
  {
    questionCode: 'Q4',
    question: 'A high level question about architecture…',
    impact: 'high',
    chosen: ['A', 'B'],
    context: 'This really is an important point…',
    captured: ['A5', 'A6', 'D2', 'C3', 'C4'],
    captureStatus: 'done',
  },
  {
    questionCode: 'Q5',
    question: 'Some question about whether you…',
    impact: 'medium',
    chosen: ['A', 'B'],
    context: 'This really is an important point…',
    captured: null,
    captureStatus: 'trailing',
  },
];

const activeQuestion = {
  questionCode: 'Q6',
  question: 'A deeper question about that other thing we said earlier',
  impact: 'medium' as Impact,
  why: 'This is the meta explanation for why the interviewer is asking this question. It helps the user understand how to respond and what other context they might want to provide.',
  options: [
    { id: 1, content: 'Option A is kind of nice' },
    { id: 2, content: 'Option B might even be better' },
    { id: 3, content: 'Option C might be the best of both worlds' },
  ],
};

// ── Story ───────────────────────────────────────────────────────────

export const Transcript: Story = () => {
  return (
    <div className="flex flex-col gap-10">
      {/* Turn 1 */}
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <ActivityPlaceholder seconds={4} tools={['Read', 'Bash']} />
        <AnsweredQuestionCard data={answeredTurns[0]!} />
      </div>

      {/* <hr className="mt-1.5 border-rule" /> */}

      {/* Turn 2 */}
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <ActivityPlaceholder seconds={7} tools={['Read', 'Bash']} />
        <AnsweredQuestionCard data={answeredTurns[1]!} />
      </div>

      {/* <hr className="mt-1.5 border-rule" /> */}

      {/* Turn 3 — still capturing */}
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <ActivityPlaceholder seconds={3} tools={['Read', 'Grep']} />
        <AnsweredQuestionCard data={answeredTurns[2]!} />
      </div>

      <hr className="mt-1.5 border-rule" />

      {/* Active turn */}
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <ActivityPlaceholder />
        <ActiveQuestionCard {...activeQuestion} />
      </div>

      {/* Submission controls */}
      <div className="mx-auto mt-4 flex w-full max-w-2xl items-center justify-between">
        <ShellButton variant="ghost">Back</ShellButton>
        <div className="flex items-center gap-2">
          <ShellButton variant="ghost">Skip</ShellButton>
          <ShellButton variant="primary">Submit</ShellButton>
        </div>
      </div>
    </div>
  );
};
