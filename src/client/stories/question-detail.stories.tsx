import type { Story, StoryDefault } from '@ladle/react';
import { useState } from 'react';

import { DrawerCard } from '@/client/components/drawer-card';
import { Checkbox } from '@/client/components/ui/checkbox';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

export default {
  title: 'Patterns / Cards / Questions',
} satisfies StoryDefault;

// ── Types ───────────────────────────────────────────────────────────

type Impact = 'high' | 'medium' | 'low';

interface QuestionOption {
  id: number;
  content: string;
  isRecommended?: boolean;
}

type Selection =
  | { mode: 'options'; values: number[]; rationale: string }
  | { mode: 'none'; rationale: string };

// ── Constants ───────────────────────────────────────────────────────

const impactColor: Record<Impact, string> = {
  high: 'text-[#e14640]',
  medium: 'text-[#d97706]',
  low: 'text-[#16a34a]',
};

// ── Question card ───────────────────────────────────────────────────

function QuestionCard({
  questionCode,
  question,
  impact,
  why,
  options,
  defaultExpanded,
}: {
  questionCode: string;
  question: string;
  impact: Impact;
  why: string;
  options: QuestionOption[];
  defaultExpanded?: boolean;
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

  const summary = <p className="text-xs leading-relaxed text-hint">{why}</p>;

  const body = (
    <>
      {/* Why this matters */}
      <p className="text-xs leading-relaxed text-sub">{why}</p>

      {/* Checkbox options */}
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

      {/* Textarea — negative margins break out of drawer padding */}
      <div className="-mx-4 -mb-4 border-t border-rule bg-white px-4 pt-3">
        <p className="text-xs text-sub">Please provide additional context for your answer.</p>
        <Textarea
          value={selection.rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Constraints, trade-offs, motivations, or reasoning worth capturing…"
          className="min-h-16 resize-none rounded-none border-0 bg-transparent px-0 pb-5 pt-2 text-sm text-ink placeholder:text-hint focus-visible:ring-0"
        />
      </div>
    </>
  );

  return (
    <DrawerCard header={header} summary={summary} defaultExpanded={defaultExpanded}>
      {body}
    </DrawerCard>
  );
}

// ── Fixture data ────────────────────────────────────────────────────

const sampleQuestions = [
  {
    questionCode: 'Q1',
    question: 'What does "category theory foundation" mean for user experience?',
    impact: 'high' as Impact,
    why: 'This determines whether we need frontend work at all. A pure backend refactor vs. exposing new primitives are fundamentally different projects with different timelines and teams.',
    options: [
      { id: 1, content: 'No visible changes — pure backend refactor' },
      { id: 2, content: 'New validation features exposed to users', isRecommended: true },
      { id: 3, content: 'Full UX redesign around mathematical primitives' },
    ],
  },
  {
    questionCode: 'Q2',
    question: 'How should the system handle conflicting requirements?',
    impact: 'medium' as Impact,
    why: 'Conflict resolution strategy affects the entire requirements graph. Choosing the wrong approach early creates cascading rework later.',
    options: [
      { id: 1, content: 'Flag conflicts for human resolution' },
      { id: 2, content: 'Auto-resolve using priority weights' },
      { id: 3, content: 'Present trade-off analysis and let the user decide' },
    ],
  },
  {
    questionCode: 'Q3',
    question: 'What level of backwards compatibility should the API maintain?',
    impact: 'low' as Impact,
    why: 'API compatibility decisions cascade into documentation requirements, migration tooling, and testing infrastructure investment.',
    options: [
      { id: 1, content: 'Strict semver with two-version support window' },
      { id: 2, content: 'Feature flags for gradual deprecation', isRecommended: true },
      { id: 3, content: 'Breaking changes allowed with migration guides' },
    ],
  },
];

// ── Stories ─────────────────────────────────────────────────────────

export const Collapsed: Story = () => {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <p className="text-xs text-hint">
        Collapsed with summary — click header to expand into full interactive form.
      </p>
      {sampleQuestions.map((q) => (
        <QuestionCard key={q.questionCode} {...q} />
      ))}
    </div>
  );
};

export const Expanded: Story = () => {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <p className="text-xs text-hint">Expanded — full interactive form visible.</p>
      {sampleQuestions.map((q) => (
        <QuestionCard key={q.questionCode} {...q} defaultExpanded />
      ))}
    </div>
  );
};
