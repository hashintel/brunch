/**
 * Pattern: Turn lifecycle — active turn card, collapsed answered-turn card,
 * activity placeholders, phase entry header, and phase terminal cards.
 *
 * Demonstrates the full transcript column composition for scope/design phases.
 */
import { Check, ChevronRight, Loader2, SkipForward, Undo2, Wrench } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/client/components/ui/button';
import { Checkbox } from '@/client/components/ui/checkbox';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

// ── Data types ───────────────────────────────────────────────────────

interface TurnOption {
  id: number;
  content: string;
  isRecommended?: boolean;
}

type TurnSelection =
  | { mode: 'options'; values: number[]; rationale: string }
  | { mode: 'none'; rationale: string };

type Impact = 'high' | 'medium' | 'low';

interface CapturedItem {
  code: string;
}

interface AnsweredTurnData {
  questionCode: string;
  question: string;
  impact: Impact;
  chosen: string[] | null;
  context: string | null;
  captured: CapturedItem[] | null;
  captureStatus: 'done' | 'trailing' | 'empty';
}

// ── Constants ────────────────────────────────────────────────────────

const impactColor: Record<Impact, string> = {
  high: 'text-[#e14640]',
  medium: 'text-[#d97706]',
  low: 'text-[#16a34a]',
};

const impactBg: Record<Impact, string> = {
  high: 'bg-[rgba(225,70,64,0.08)]',
  medium: 'bg-[rgba(217,119,6,0.08)]',
  low: 'bg-[rgba(22,163,106,0.08)]',
};

// ── Fixture data ─────────────────────────────────────────────────────

const sampleOptions: TurnOption[] = [
  { id: 1, content: 'Flag conflicts for human resolution' },
  { id: 2, content: 'Auto-resolve using priority weights', isRecommended: true },
  { id: 3, content: 'Present trade-off analysis and let the user decide' },
  { id: 4, content: 'Defer conflict handling to a later phase' },
];

const answeredTurnVariants: AnsweredTurnData[] = [
  {
    questionCode: 'Q1',
    question: 'What does "category theory foundation" mean for user experience?',
    impact: 'high',
    chosen: ['New validation features exposed to users', 'Full UX redesign around mathematical primitives'],
    context: 'This really is an important architectural decision that affects every downstream team.',
    captured: [{ code: 'ASM-5' }, { code: 'ASM-6' }, { code: 'DEC-2' }, { code: 'CST-3' }, { code: 'CST-4' }],
    captureStatus: 'done',
  },
  {
    questionCode: 'Q2',
    question: 'How should the system handle authentication for external integrations?',
    impact: 'medium',
    chosen: ['OAuth 2.0 with PKCE flow', 'API key rotation support'],
    context: 'This really is critical for enterprise adoption and compliance requirements.',
    captured: null,
    captureStatus: 'trailing',
  },
  {
    questionCode: 'Q3',
    question: 'What level of backwards compatibility should the API maintain?',
    impact: 'low',
    chosen: ['Semantic versioning with deprecation warnings', 'Feature flags for gradual rollout'],
    context: 'This really is about managing the upgrade experience for existing users.',
    captured: null,
    captureStatus: 'empty',
  },
  {
    questionCode: 'Q4',
    question: 'Should the notification system support real-time push or polling?',
    impact: 'medium',
    chosen: ['WebSocket-based real-time push', 'SSE fallback for constrained environments'],
    context: null,
    captured: [{ code: 'DEC-1' }, { code: 'REQ-2' }],
    captureStatus: 'done',
  },
  {
    questionCode: 'Q5',
    question: 'How should we approach data migration from the legacy system?',
    impact: 'high',
    chosen: null,
    context: 'Full migration should happen in staged batches with rollback capability at each step.',
    captured: [{ code: 'GOL-1' }],
    captureStatus: 'done',
  },
  {
    questionCode: 'Q6',
    question: 'What access control model best fits the multi-tenant architecture?',
    impact: 'medium',
    chosen: ['None'],
    context: 'The real option is a hybrid RBAC/ABAC model scoped per tenant with cross-tenant federation.',
    captured: [{ code: 'CTX-1' }],
    captureStatus: 'done',
  },
];

// ── Active Turn Card ─────────────────────────────────────────────────

function ActiveTurnCard({
  questionCode,
  question,
  impact,
  why,
  options,
  showBack = false,
}: {
  questionCode: string;
  question: string;
  impact: Impact;
  why: string;
  options: TurnOption[];
  showBack?: boolean;
}) {
  const [selection, setSelection] = useState<TurnSelection>({
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
  const isValid = hasSelection && rationaleValid;

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
      {/* White header — question code + impact + question text */}
      <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-hint">{questionCode}</span>
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium',
                impactColor[impact],
                impactBg[impact],
              )}
            >
              {impact[0]!.toUpperCase() + impact.slice(1)} Impact
            </span>
          </div>
          <p className="text-base leading-snug font-medium tracking-[-0.015em] text-ink">{question}</p>
        </div>
      </div>

      {/* Tinted body */}
      <div className="flex flex-col gap-3 p-4">
        {/* Why this matters */}
        <div className="text-sm leading-relaxed text-sub italic">{why}</div>

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

          {/* Separator + "None of the above" */}
          <div className="my-1.5 border-t border-rule" />

          <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm">
            <Checkbox checked={isNone} onCheckedChange={toggleNone} />
            <span className={cn('text-sub', isNone && 'text-ink')}>None of the above</span>
          </label>
        </div>

        {/* Response note */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-sub">Additional context</p>
            {rationaleRequired ? (
              <span className="text-[11px] font-medium text-[#e14640]">Required</span>
            ) : (
              <span className="text-[11px] text-hint">Optional</span>
            )}
          </div>
          <Textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Please provide additional context for your answer"
            className={cn(
              'min-h-16 rounded-xl border-rule bg-white text-sm',
              rationaleRequired && !rationaleValid && 'border-[#e14640]/40',
            )}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div>
            {showBack && (
              <Button variant="ghost" size="sm" onClick={() => console.log('Back')}>
                <Undo2 data-icon="inline-start" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => console.log('Skip')}>
              <SkipForward data-icon="inline-start" />
              Skip
            </Button>
            <Button disabled={!isValid} onClick={() => console.log('Submit', selection)}>
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Collapsed Answered Turn Card ─────────────────────────────────────

function AnsweredTurnCard({ data }: { data: AnsweredTurnData }) {
  const { questionCode, question, impact, chosen, context, captured, captureStatus } = data;

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-white">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex flex-1 flex-col gap-1.5">
          {/* Code + impact */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-hint">{questionCode}</span>
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium',
                impactColor[impact],
                impactBg[impact],
              )}
            >
              {impact[0]!.toUpperCase() + impact.slice(1)} Impact
            </span>
          </div>

          {/* Truncated question */}
          <p className="truncate text-sm text-sub">{question}</p>

          {/* Response summary */}
          <div className="flex items-center gap-1.5 text-xs text-sub">
            {chosen && (
              <span>
                <span className="font-medium text-ink">Chosen:</span> {chosen.join(', ')}
              </span>
            )}
            {chosen && context && <span className="text-hint">|</span>}
            {context && (
              <span className="truncate">
                <span className="font-medium text-ink">Context:</span>{' '}
                <span className="italic">"{context.length > 60 ? context.slice(0, 60) + '…' : context}"</span>
              </span>
            )}
          </div>

          {/* Captured row */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-hint">Captured:</span>
            {captureStatus === 'trailing' ? (
              <span className="flex items-center gap-1 text-sub">
                <Loader2 className="size-3 animate-spin" />
                Still thinking…
              </span>
            ) : captureStatus === 'empty' ? (
              <span className="text-hint">—</span>
            ) : captured && captured.length > 0 ? (
              <span className="font-mono text-sub">{captured.map((c) => c.code).join(', ')}</span>
            ) : (
              <span className="text-hint">—</span>
            )}
          </div>
        </div>

        {/* Green checkmark */}
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(22,163,106,0.1)]">
          <Check className="size-3.5 text-[#16a34a]" />
        </div>
      </div>
    </div>
  );
}

// ── Activity Placeholders ────────────────────────────────────────────

function ActivityPlaceholderLive() {
  return (
    <div className="flex items-center gap-2 px-2 py-3">
      <Loader2 className="size-3.5 animate-spin text-[#2070e6]" />
      <span className="text-xs text-sub">Thinking…</span>
      <div className="flex items-center gap-1">
        <Wrench className="size-3 text-hint" />
        <span className="text-xs text-hint">Tools appearing…</span>
      </div>
    </div>
  );
}

function ActivityPlaceholderPersisted({ tools }: { tools?: string[] }) {
  return (
    <div className="flex items-center gap-2 px-2 py-3">
      <span className="text-xs text-hint">Thinking…</span>
      {tools && tools.length > 0 && (
        <>
          <span className="text-xs text-hint">·</span>
          <span className="text-xs text-hint">Tools: {tools.join(', ')}</span>
        </>
      )}
    </div>
  );
}

function ActivityPlaceholderMinimal() {
  return (
    <div className="flex items-center justify-center py-1.5">
      <div className="size-1 rounded-full bg-rule" />
    </div>
  );
}

// ── Phase Entry Header ───────────────────────────────────────────────

function PhaseEntryHeader({ name, description }: { name: string; description: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-white p-5">
      <h3 className="text-base font-medium text-ink">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-sub">{description}</p>
    </div>
  );
}

// ── Phase Terminal Cards ─────────────────────────────────────────────

function PhaseHandoffCard({ nextPhase }: { nextPhase: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-wash p-5">
      <p className="text-sm leading-relaxed text-sub">
        This phase is now closed, and you can proceed to the next phase.
      </p>
      <Button className="mt-3" variant="outline" onClick={() => console.log('Move on')}>
        Move on to {nextPhase}
        <ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  );
}

function WorkflowCompleteCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-wash p-5">
      <p className="text-sm font-medium text-ink">The interview workspace is complete</p>
      <p className="mt-1 text-sm leading-relaxed text-sub">
        All phases have been reviewed and finalized. You can now export the specification.
      </p>
      <Button className="mt-3" onClick={() => console.log('Open export')}>
        Open export preview
      </Button>
    </div>
  );
}

// ── Main Story Component ─────────────────────────────────────────────

export function TurnLifecyclePage() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Pattern — Turn Lifecycle
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Active turn cards, collapsed answered-turn cards, activity placeholders, phase entry headers, and
          phase terminal cards — the full transcript column vocabulary.
        </p>

        <Separator className="my-8" />

        {/* ── Section 1: Active Turn Card ───────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Active Turn Card</h2>
          <p className="mt-1 text-sm text-sub">
            Interactive question card with checkbox options, "None of the above" exclusive toggle, response
            note textarea, and [Back] [Skip] [Submit] action buttons.
          </p>

          <div className="mt-6 grid grid-cols-[1fr_280px] gap-6">
            <div>
              <p className="mb-2 text-xs text-hint">First turn (Back hidden)</p>
              <ActiveTurnCard
                questionCode="Q1"
                question="How should the system handle conflicting requirements across different stakeholder groups?"
                impact="medium"
                why="Conflict resolution strategy affects the entire requirements graph. Choosing the wrong approach early creates cascading rework later."
                options={sampleOptions}
                showBack={false}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-rule bg-white p-3">
                <p className="text-xs font-medium text-sub">Button rules</p>
                <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-hint">
                  <li>
                    <span className="text-hint">·</span> Back: hidden on first turn
                  </li>
                  <li>
                    <span className="text-hint">·</span> Skip: always shown
                  </li>
                  <li>
                    <span className="text-hint">·</span> Submit: enabled when selection valid
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs text-hint">Subsequent turn (Back visible)</p>
            <div className="max-w-2xl">
              <ActiveTurnCard
                questionCode="Q3"
                question="What level of backwards compatibility should the API maintain?"
                impact="low"
                why="API compatibility decisions cascade into documentation requirements, migration tooling, and testing infrastructure investment."
                options={[
                  { id: 1, content: 'Strict semver with two-version support window' },
                  { id: 2, content: 'Feature flags for gradual deprecation', isRecommended: true },
                  { id: 3, content: 'Breaking changes allowed with migration guides' },
                ]}
                showBack={true}
              />
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 2: Collapsed Answered Turn Variants ────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Collapsed Answered Turn Variants</h2>
          <p className="mt-1 text-sm text-sub">
            Six response/capture combinations that a completed turn card can display.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            {[
              'Full capture + context',
              'Observer trailing',
              'No captures',
              'No context provided',
              'Free-text only',
              'None-of-the-above',
            ].map((label, i) => (
              <div key={label}>
                <p className="mb-2 text-xs text-hint">{label}</p>
                <div className="max-w-2xl">
                  <AnsweredTurnCard data={answeredTurnVariants[i]!} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 3: Activity Placeholders ──────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Activity Placeholders</h2>
          <p className="mt-1 text-sm text-sub">
            Three fidelity levels for representing interviewer processing between turns.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-6">
            <div>
              <p className="mb-2 text-xs text-hint">Live streaming</p>
              <div className="rounded-lg border border-rule bg-white">
                <ActivityPlaceholderLive />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-hint">Persisted replay</p>
              <div className="rounded-lg border border-rule bg-white">
                <ActivityPlaceholderPersisted tools={['Read', 'Bash']} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-hint">Minimal marker</p>
              <div className="rounded-lg border border-rule bg-white">
                <ActivityPlaceholderMinimal />
              </div>
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 4: Phase Cards ────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Phase Cards</h2>
          <p className="mt-1 text-sm text-sub">Phase entry header and terminal cards.</p>

          <div className="mt-6 flex flex-col gap-6">
            <div>
              <p className="mb-2 text-xs text-hint">Phase entry header</p>
              <div className="max-w-2xl">
                <PhaseEntryHeader
                  name="Design phase"
                  description="In this phase, we will work through a series of questions to resolve key design decisions. Each question explores a trade-off or commitment that shapes the technical architecture."
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-hint">Phase handoff</p>
              <div className="max-w-2xl">
                <PhaseHandoffCard nextPhase="the requirements review" />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-hint">Workflow complete</p>
              <div className="max-w-2xl">
                <WorkflowCompleteCard />
              </div>
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 5: Full Transcript Column ─────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Full Transcript Column</h2>
          <p className="mt-1 text-sm text-sub">
            A realistic mid-phase transcript composing all elements in correct sequence.
          </p>

          <div className="mt-6 max-w-2xl">
            <div className="flex flex-col gap-3">
              <PhaseEntryHeader
                name="Design phase"
                description="In this phase, we will work through a series of questions to resolve key design decisions. Each question explores a trade-off or commitment that shapes the technical architecture."
              />

              <ActivityPlaceholderPersisted tools={['Read', 'Bash']} />

              <AnsweredTurnCard data={answeredTurnVariants[0]!} />

              <ActivityPlaceholderMinimal />

              <AnsweredTurnCard data={answeredTurnVariants[2]!} />

              <ActivityPlaceholderPersisted tools={['Read', 'Grep']} />

              <ActiveTurnCard
                questionCode="Q3"
                question="What level of backwards compatibility should the API maintain?"
                impact="low"
                why="API compatibility decisions cascade into documentation requirements, migration tooling, and testing infrastructure investment."
                options={sampleOptions}
                showBack={true}
              />
            </div>
          </div>

          <div className="mt-8">
            <p className="mb-2 text-xs text-hint">Closed phase variant</p>
            <div className="max-w-2xl">
              <div className="flex flex-col gap-3">
                <PhaseEntryHeader
                  name="Design phase"
                  description="In this phase, we will work through a series of questions to resolve key design decisions."
                />

                <ActivityPlaceholderPersisted />

                <AnsweredTurnCard data={answeredTurnVariants[0]!} />

                <ActivityPlaceholderMinimal />

                <AnsweredTurnCard data={answeredTurnVariants[3]!} />

                <PhaseHandoffCard nextPhase="the requirements review" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
