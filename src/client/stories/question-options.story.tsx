/**
 * Pattern: Question option selection with mutual exclusion.
 *
 * The user either (A) checks one or more provided options + optional rationale,
 * or (B) selects "None of these" + required rationale.
 *
 * Ported from brunch-ui /patterns/question-options.
 */
import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';

import { Checkbox } from '@/client/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

// ── Data types ───────────────────────────────────────────────────────

interface QuestionOption {
  id: number;
  content: string;
  isRecommended?: boolean;
}

type Selection =
  | { mode: 'options'; values: number[]; rationale: string }
  | { mode: 'none'; rationale: string };

// ── Sample questions ─────────────────────────────────────────────────

const sampleQuestions: {
  question: string;
  impact: 'high' | 'medium' | 'low';
  why: string;
  options: QuestionOption[];
}[] = [
  {
    question: 'What does "category theory foundation" mean for user experience?',
    impact: 'high',
    why: 'This determines whether we need frontend work at all. A pure backend refactor vs. exposing new primitives are fundamentally different projects with different timelines and teams.',
    options: [
      { id: 1, content: 'No visible changes — pure backend refactor' },
      {
        id: 2,
        content: 'New validation features exposed to users',
        isRecommended: true,
      },
      { id: 3, content: 'Full UX redesign around mathematical primitives' },
      { id: 4, content: 'Not sure yet' },
    ],
  },
  {
    question: 'How should the system handle conflicting requirements?',
    impact: 'medium',
    why: 'Conflict resolution strategy affects the entire requirements graph. Choosing the wrong approach early creates cascading rework later.',
    options: [
      { id: 1, content: 'Flag conflicts for human resolution' },
      { id: 2, content: 'Auto-resolve using priority weights' },
      { id: 3, content: 'Present trade-off analysis and let the user decide' },
    ],
  },
];

// ── Impact color ─────────────────────────────────────────────────────

const impactColor: Record<string, string> = {
  high: 'text-[#e14640]',
  medium: 'text-[#d97706]',
  low: 'text-[#16a34a]',
};

// ── Interactive question card (expanded, inline "why") ───────────────

function QuestionOptionsCard({
  question,
  impact,
  why,
  options,
}: {
  question: string;
  impact: 'high' | 'medium' | 'low';
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
  const rationale = selection.rationale;
  const hasSelection = isNone || selectedValues.length > 0;
  const rationaleRequired = isNone;
  const rationaleValid = !rationaleRequired || rationale.trim().length > 0;

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

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint">
      {/* White header card — question + impact */}
      <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2">
          <p className={cn('text-[11px] leading-none font-medium', impactColor[impact])}>
            {impact[0].toUpperCase() + impact.slice(1)} Impact
          </p>
          <p className="text-base leading-snug font-medium tracking-[-0.015em] text-ink">{question}</p>
        </div>
      </div>

      {/* Tinted body */}
      <div className="flex flex-col gap-3 p-4">
        {/* Checkbox options */}
        <div className="flex flex-col">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm',
                  isNone && 'opacity-40',
                )}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => toggleOption(opt.id)} />
                <span className={isSelected ? 'text-ink' : 'text-sub'}>{opt.content}</span>
                {opt.isRecommended && (
                  <span className="text-[11px] font-medium text-[#2070e6]">Recommended</span>
                )}
              </label>
            );
          })}

          {/* Separator + "None of these" */}
          <div className="my-1.5 border-t border-rule" />

          <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm">
            <Checkbox checked={isNone} onCheckedChange={toggleNone} />
            <span className={cn('text-sub', isNone && 'text-ink')}>None of these</span>
          </label>
        </div>

        {/* Rationale textarea */}
        {hasSelection && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-sub">Rationale</p>
              {rationaleRequired ? (
                <span className="text-[11px] font-medium text-[#e14640]">Required</span>
              ) : (
                <span className="text-[11px] text-hint">Optional</span>
              )}
            </div>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={
                rationaleRequired
                  ? 'Explain what the real option(s) should be and why…'
                  : 'Add context for your selection…'
              }
              className={cn(
                'min-h-16 rounded-xl border-rule bg-white text-sm',
                rationaleRequired && !rationaleValid && 'border-[#e14640]/40',
              )}
            />
          </div>
        )}

        {/* Why this matters — inline card */}
        <div className="overflow-hidden rounded-xl border border-rule bg-white p-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-sub">Why this matters</p>
            <p className="text-sm leading-relaxed text-sub">{why}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Collapsible question card (inline "why") ─────────────────────────

function CollapsibleQuestionCard({
  questionNumber,
  question,
  impact,
  why,
  options,
  answered,
  defaultOpen,
}: {
  questionNumber: string;
  question: string;
  impact: 'high' | 'medium' | 'low';
  why: string;
  options: QuestionOption[];
  answered?: { values: number[]; rationale: string };
  defaultOpen?: boolean;
}) {
  const isAnswered = !!answered;
  const [open, setOpen] = useState(isAnswered ? (defaultOpen ?? true) : true);

  const [selection, setSelection] = useState<Selection>(
    isAnswered
      ? { mode: 'options', values: answered.values, rationale: answered.rationale }
      : { mode: 'options', values: [], rationale: '' },
  );

  const isNone = selection.mode === 'none';
  const selectedValues = isNone ? [] : selection.values;
  const rationaleRequired = isNone;
  const hasSelection = isNone || selectedValues.length > 0;

  function toggleOption(id: number) {
    if (isAnswered) return;
    setSelection((prev) => {
      if (prev.mode === 'none') {
        return { mode: 'options', values: [id], rationale: prev.rationale };
      }
      const values = prev.values.includes(id) ? prev.values.filter((v) => v !== id) : [...prev.values, id];
      return { ...prev, values };
    });
  }

  function toggleNone() {
    if (isAnswered) return;
    setSelection((prev) => {
      if (prev.mode === 'none') {
        return { mode: 'options', values: [], rationale: prev.rationale };
      }
      return { mode: 'none', rationale: prev.rationale };
    });
  }

  function setRationale(text: string) {
    if (isAnswered) return;
    setSelection((prev) => ({ ...prev, rationale: text }));
  }

  const answerSummary = isAnswered
    ? options
        .filter((o) => answered.values.includes(o.id))
        .map((o) => o.content)
        .join('; ')
    : '';

  const headerContent = (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-hint">{questionNumber}</span>
          <span className={cn('text-[11px] leading-none font-medium', impactColor[impact])}>
            {impact[0].toUpperCase() + impact.slice(1)} Impact
          </span>
        </div>
        <p className="text-sm leading-snug font-medium tracking-[-0.015em] text-ink">{question}</p>
        {isAnswered && !open && answerSummary && (
          <p className="mt-0.5 text-xs leading-relaxed text-sub">{answerSummary}</p>
        )}
      </div>

      {isAnswered && (
        <ChevronDown className={cn('size-4 shrink-0 text-hint transition-transform', open && 'rotate-180')} />
      )}
    </div>
  );

  const bodyContent = (
    <div className="flex flex-col gap-3 p-4">
      {/* Inline "why" paragraph */}
      <p className="text-xs leading-relaxed text-hint">{why}</p>

      {/* Checkbox options */}
      <div className="flex flex-col">
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-lg py-2 text-left text-sm',
                isAnswered ? 'cursor-default' : 'cursor-pointer',
                isNone && 'opacity-40',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleOption(opt.id)}
                disabled={isAnswered}
              />
              <span className={isSelected ? 'text-ink' : 'text-sub'}>{opt.content}</span>
              {opt.isRecommended && !isAnswered && (
                <span className="text-[11px] font-medium text-[#2070e6]">Recommended</span>
              )}
            </label>
          );
        })}

        {!isAnswered && (
          <>
            <div className="my-1.5 border-t border-rule" />
            <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm">
              <Checkbox checked={isNone} onCheckedChange={toggleNone} />
              <span className={cn('text-sub', isNone && 'text-ink')}>None of these</span>
            </label>
          </>
        )}
      </div>

      {/* Rationale */}
      {(hasSelection || isAnswered) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-sub">Rationale</p>
            {!isAnswered &&
              (rationaleRequired ? (
                <span className="text-[11px] font-medium text-[#e14640]">Required</span>
              ) : (
                <span className="text-[11px] text-hint">Optional</span>
              ))}
          </div>
          {isAnswered ? (
            selection.rationale && <p className="text-sm leading-relaxed text-sub">{selection.rationale}</p>
          ) : (
            <Textarea
              value={selection.rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={
                rationaleRequired
                  ? 'Explain what the real option(s) should be and why…'
                  : 'Add context for your selection…'
              }
              className={cn(
                'min-h-16 rounded-xl border-rule bg-white text-sm',
                rationaleRequired && selection.rationale.trim().length === 0 && 'border-[#e14640]/40',
              )}
            />
          )}
        </div>
      )}
    </div>
  );

  if (isAnswered) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="overflow-hidden rounded-xl border border-rule bg-tint">
          <CollapsibleTrigger className="-m-px w-[calc(100%+2px)] cursor-pointer overflow-hidden rounded-xl border border-rule bg-white p-4 text-left shadow-[var(--shadow-card)]">
            {headerContent}
          </CollapsibleTrigger>
          <CollapsibleContent>{bodyContent}</CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint">
      <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
        {headerContent}
      </div>
      {bodyContent}
    </div>
  );
}

// ── State inspector ──────────────────────────────────────────────────

function StateInspector({ selection }: { selection: Selection }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-[#1e1e1e] p-4 text-xs leading-relaxed text-[#d4d4d4]">
      <code>{JSON.stringify(selection, null, 2)}</code>
    </pre>
  );
}

// ── Story: Full interactive demo ─────────────────────────────────────

export const InteractiveDemo = () => {
  const [demoSelection, setDemoSelection] = useState<Selection>({
    mode: 'options',
    values: [],
    rationale: '',
  });

  const demoQ = sampleQuestions[0];
  const isNone = demoSelection.mode === 'none';
  const selectedValues = isNone ? [] : demoSelection.values;
  const rationaleRequired = isNone;
  const rationaleValid = !rationaleRequired || demoSelection.rationale.trim().length > 0;
  const hasSelection = isNone || selectedValues.length > 0;
  const isValid = hasSelection && rationaleValid;

  function toggleOption(id: number) {
    setDemoSelection((prev) => {
      if (prev.mode === 'none') {
        return { mode: 'options', values: [id], rationale: prev.rationale };
      }
      const values = prev.values.includes(id) ? prev.values.filter((v) => v !== id) : [...prev.values, id];
      return { ...prev, values };
    });
  }

  function toggleNone() {
    setDemoSelection((prev) => {
      if (prev.mode === 'none') {
        return { mode: 'options', values: [], rationale: prev.rationale };
      }
      return { mode: 'none', rationale: prev.rationale };
    });
  }

  function setRationale(text: string) {
    setDemoSelection((prev) => ({ ...prev, rationale: text }));
  }

  function resetDemo() {
    setDemoSelection({ mode: 'options', values: [], rationale: '' });
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Pattern — Question Options
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Checkbox multi-select with an exclusive "None of these" escape hatch. Rationale is optional when
          options are selected, required when "None of these" is active.
        </p>

        <Separator className="my-8" />

        {/* Interactive demo with state */}
        <section>
          <h2 className="text-base font-medium text-ink">Interactive Demo</h2>
          <p className="mt-1 text-sm text-sub">
            Try selecting options, toggling "None of these", and entering rationale. The state inspector
            updates live.
          </p>

          <div className="mt-6 grid grid-cols-[1fr_320px] gap-6">
            <div className="overflow-hidden rounded-xl border border-rule bg-tint">
              <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-col gap-2">
                  <p className={cn('text-[11px] leading-none font-medium', impactColor[demoQ.impact])}>
                    {demoQ.impact[0].toUpperCase() + demoQ.impact.slice(1)} Impact
                  </p>
                  <p className="text-base leading-snug font-medium tracking-[-0.015em] text-ink">
                    {demoQ.question}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-col">
                  {demoQ.options.map((opt) => {
                    const isSelected = selectedValues.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'flex h-8 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm',
                          isNone && 'opacity-40',
                        )}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOption(opt.id)} />
                        <span className={isSelected ? 'text-ink' : 'text-sub'}>{opt.content}</span>
                        {opt.isRecommended && (
                          <span className="text-[11px] font-medium text-[#2070e6]">Recommended</span>
                        )}
                      </label>
                    );
                  })}

                  <div className="my-1.5 border-t border-rule" />

                  <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm">
                    <Checkbox checked={isNone} onCheckedChange={toggleNone} />
                    <span className={cn('text-sub', isNone && 'text-ink')}>None of these</span>
                  </label>
                </div>

                {hasSelection && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-sub">Rationale</p>
                      {rationaleRequired ? (
                        <span className="text-[11px] font-medium text-[#e14640]">Required</span>
                      ) : (
                        <span className="text-[11px] text-hint">Optional</span>
                      )}
                    </div>
                    <Textarea
                      value={demoSelection.rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder={
                        rationaleRequired
                          ? 'Explain what the real option(s) should be and why…'
                          : 'Add context for your selection…'
                      }
                      className={cn(
                        'min-h-16 rounded-xl border-rule bg-white text-sm',
                        rationaleRequired && !rationaleValid && 'border-[#e14640]/40',
                      )}
                    />
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-rule bg-white p-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-sub">Why this matters</p>
                    <p className="text-sm leading-relaxed text-sub">{demoQ.why}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-sub">State</p>
                <button
                  type="button"
                  onClick={resetDemo}
                  className="flex items-center gap-1 text-[11px] text-hint hover:text-sub"
                >
                  <X className="size-3" />
                  Reset
                </button>
              </div>
              <StateInspector selection={demoSelection} />

              <div className="flex items-center gap-2">
                <span className="text-xs text-sub">Valid:</span>
                <span className={cn('text-xs font-medium', isValid ? 'text-[#16a34a]' : 'text-[#e14640]')}>
                  {isValid ? 'Yes' : 'No'}
                </span>
              </div>

              <div className="rounded-lg border border-rule bg-white p-3">
                <p className="text-xs font-medium text-sub">Rules</p>
                <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-hint">
                  <li>
                    <span
                      className={cn(
                        !isNone && selectedValues.length > 0
                          ? 'text-[#16a34a]'
                          : isNone
                            ? 'text-[#16a34a]'
                            : 'text-hint',
                      )}
                    >
                      {isNone ? '+' : selectedValues.length > 0 ? '+' : '-'}
                    </span>{' '}
                    Select 1+ options OR "None of these"
                  </li>
                  <li>
                    <span
                      className={cn(!rationaleRequired || rationaleValid ? 'text-[#16a34a]' : 'text-hint')}
                    >
                      {!rationaleRequired || rationaleValid ? '+' : '-'}
                    </span>{' '}
                    Rationale required when "None" selected
                  </li>
                  <li>
                    <span className="text-hint">~</span> Selecting any checkbox clears "None"
                  </li>
                  <li>
                    <span className="text-hint">~</span> Selecting "None" clears all checkboxes
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* Expanded card variant */}
        <section>
          <h2 className="text-base font-medium text-ink">Expanded Card</h2>
          <p className="mt-1 text-sm text-sub">Standalone card with inline "why this matters" section.</p>

          <div className="mt-6 max-w-2xl">
            <QuestionOptionsCard {...sampleQuestions[1]} />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Collapsible cards */}
        <section>
          <h2 className="text-base font-medium text-ink">Collapsible Cards</h2>
          <p className="mt-1 text-sm text-sub">
            Header bar acts as a collapse toggle for answered cards. "Why this matters" shown as an inline
            paragraph.
          </p>

          <div className="mt-6 flex flex-col gap-6">
            <div>
              <p className="mb-2 text-xs text-hint">Unanswered (always open)</p>
              <div className="max-w-2xl">
                <CollapsibleQuestionCard
                  questionNumber="Q01"
                  question={sampleQuestions[1].question}
                  impact="medium"
                  why={sampleQuestions[1].why}
                  options={sampleQuestions[1].options}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-hint">Answered + collapsed</p>
              <div className="max-w-2xl">
                <CollapsibleQuestionCard
                  questionNumber="Q02"
                  question={sampleQuestions[0].question}
                  impact="high"
                  why={sampleQuestions[0].why}
                  options={sampleQuestions[0].options}
                  answered={{
                    values: [2, 3],
                    rationale: 'Users need to see validation features before we redesign.',
                  }}
                  defaultOpen={false}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-hint">Answered + expanded</p>
              <div className="max-w-2xl">
                <CollapsibleQuestionCard
                  questionNumber="Q03"
                  question={sampleQuestions[1].question}
                  impact="medium"
                  why={sampleQuestions[1].why}
                  options={sampleQuestions[1].options}
                  answered={{ values: [1, 3], rationale: '' }}
                  defaultOpen={true}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
};
