import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Impact, ProjectStateTurn } from '@/shared/api-types.js';
import { getPersistedTurnResponse } from '@/shared/project-state-turn.js';

import { cn } from '../lib/utils';
import { ShellButton } from './app-shell';
import { DrawerCard } from './drawer-card';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';

// ── Constants ───────────────────────────────────────────────────────

const impactColor: Record<Impact, string> = {
  high: 'text-[color:#e14640]',
  medium: 'text-[color:#d97706]',
  low: 'text-[color:#16a34a]',
};

// ── Activity placeholder ────────────────────────────────────────────

export function ActivityPlaceholder({ seconds, tools }: { seconds?: number; tools?: string[] }) {
  return (
    <div className="flex items-center justify-between px-1 py-1.5">
      <span className="text-xs text-hint">{seconds != null ? `Thought for ${seconds}s` : 'Thinking…'}</span>
      {tools && tools.length > 0 && <span className="text-xs text-hint">Tools: {tools.join(', ')}</span>}
    </div>
  );
}

// ── Answered question card ───────────────────────────────────────────

export function AnsweredQuestionCard({
  turn,
  questionCode,
  captureStatus,
}: {
  turn: ProjectStateTurn;
  questionCode: string;
  captureStatus?: 'waiting' | 'applying';
}) {
  const persistedResponse = getPersistedTurnResponse(turn);
  const selectedPositions =
    persistedResponse && turn.options
      ? turn.options
          .filter((opt) => persistedResponse.selectedOptionIds.includes(opt.id))
          .map((opt) => opt.position + 1)
      : [];
  const chosenSummary =
    selectedPositions.length > 0
      ? selectedPositions.join(', ')
      : persistedResponse?.freeText
        ? 'None'
        : turn.answer?.trim() || '—';
  const responseContext = persistedResponse?.freeText?.trim() || turn.answer?.trim() || null;
  const capturedItems = turn.captured_items ?? [];
  const displayCaptureStatus: 'done' | 'trailing' =
    captureStatus === 'waiting' || captureStatus === 'applying' ? 'trailing' : 'done';
  const impact = turn.impact ?? 'low';

  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-row text-[12px] items-center justify-between gap-2.5">
        <span className={cn('font-medium', impactColor[impact])}>
          {impact[0]!.toUpperCase() + impact.slice(1)} Impact
        </span>
        <span className="flex text-[11px] text-[#16a34a] h-5 gap-1 -m-0.5 px-2 shrink-0 items-center justify-center rounded-full bg-[rgba(22,163,106,0.1)]">
          Answered
          <Check className="size-2.5" />
        </span>
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="shrink-0 text-sm-plus font-medium text-hint">{questionCode}</span>
        <p className="flex-1 text-sm-plus font-medium tracking-[-0.015em] text-ink">{turn.question}</p>
      </div>
    </div>
  );

  const summary = (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-2.5 text-xs">
        <span className="text-sub">Choices:</span>
        <span className="text-ink">{chosenSummary}</span>
        {responseContext && (
          <>
            <span className="shrink-0 text-rule">|</span>
            <div className="min-w-0 grow">
              <span className="block truncate text-sub">
                Context: <span className="italic text-sub">"{responseContext}"</span>
              </span>
            </div>
          </>
        )}
      </div>
      <div className="my-2.5 border-t border-rule" />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-sub">Captured:</span>
        {displayCaptureStatus === 'trailing' ? (
          <span className="flex items-center gap-1 text-xs text-sub">
            <Loader2 className="size-3 animate-spin" />
            Still thinking…
          </span>
        ) : capturedItems.length > 0 ? (
          capturedItems.map((item) => (
            <span
              key={`${item.collection}:${item.id}`}
              className="inline-flex h-5 items-center rounded bg-wash px-1.5 text-[11px] font-medium leading-none text-sub"
            >
              {item.referenceCode ?? `#${item.id}`}
            </span>
          ))
        ) : (
          <span className="text-xs text-hint">—</span>
        )}
      </div>
    </div>
  );

  return (
    <div data-testid="answered-turn-card">
      <DrawerCard header={header} summary={summary} locked />
    </div>
  );
}

// ── Active question card ────────────────────────────────────────────

type TurnCardOption = Pick<
  NonNullable<ProjectStateTurn['options']>[number],
  'position' | 'content' | 'is_recommended'
>;

type ReviewSetItem = {
  content: string;
  referenceCode?: string | null;
  reviewStatus?: string | null;
};

export function ActiveQuestionCard({
  id,
  question,
  why,
  impact,
  options,
  onSubmitResponse,
  onBack,
  onSkip,
  persistedSelectedPositions,
  persistedFreeText,
  hasPersistedResponse,
  disabled,
  state,
  reviewSet,
}: {
  id: string;
  question: string;
  why: string | null;
  impact: ProjectStateTurn['impact'];
  options: readonly TurnCardOption[];
  onSubmitResponse?: (positions: number[], freeText?: string) => void | Promise<void>;
  onBack?: () => void;
  onSkip?: () => void;
  persistedSelectedPositions: number[];
  persistedFreeText: string;
  hasPersistedResponse: boolean;
  disabled: boolean;
  state: 'active' | 'submitted';
  reviewSet?: {
    readonly title: string;
    readonly items: readonly ReviewSetItem[];
  };
}) {
  const [selectedPositions, setSelectedPositions] = useState<number[]>(persistedSelectedPositions);
  const [freeText, setFreeText] = useState(persistedFreeText);
  const [noneOfTheAbove, setNoneOfTheAbove] = useState(false);
  const hasSelection = selectedPositions.length > 0;
  const hasFreeText = freeText.trim().length > 0;
  const canSubmit = hasSelection || (noneOfTheAbove && hasFreeText);
  const isReviewTurn = Boolean(reviewSet);
  const isSubmitted = state === 'submitted';
  const isReadOnly = disabled || hasPersistedResponse || isSubmitted;
  const displayImpact = impact ?? 'low';

  useEffect(() => {
    if (!hasPersistedResponse) {
      return;
    }

    setSelectedPositions(persistedSelectedPositions);
    setFreeText(persistedFreeText);
  }, [hasPersistedResponse, persistedFreeText, persistedSelectedPositions]);

  function toggleSelection(position: number) {
    if (isReadOnly) {
      return;
    }

    setNoneOfTheAbove(false);
    setSelectedPositions((current) =>
      isReviewTurn
        ? current.includes(position)
          ? []
          : [position]
        : current.includes(position)
          ? current.filter((value) => value !== position)
          : [...current, position],
    );
  }

  function toggleNone() {
    if (isReadOnly) {
      return;
    }

    setNoneOfTheAbove((prev) => !prev);
    setSelectedPositions([]);
  }

  const header = (
    <div className="flex flex-col gap-1">
      <span className={cn('text-xs font-medium', impactColor[displayImpact])}>
        {displayImpact[0]!.toUpperCase() + displayImpact.slice(1)} Impact
      </span>
      <p className="text-[17px] leading-[1.4] font-medium tracking-[-0.015em] text-ink">{question}</p>
    </div>
  );

  const body = (
    <>
      {why && <p className="text-xs leading-relaxed text-sub">{why}</p>}

      {reviewSet ? (
        <div className="rounded-lg border bg-background p-3" data-testid="review-set-card">
          <div className="mb-2 text-sm font-medium text-foreground">{reviewSet.title}</div>
          <div className="space-y-2">
            {reviewSet.items.map((item) => (
              <div key={`${item.referenceCode ?? item.content}`} className="rounded-md border px-3 py-2">
                {item.referenceCode ? (
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.referenceCode}
                  </div>
                ) : null}
                <div className="mt-1 text-sm text-foreground">{item.content}</div>
                {item.reviewStatus ? (
                  <div className="mt-1 text-xs text-muted-foreground">Status: {item.reviewStatus}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const isSelected = selectedPositions.includes(opt.position);
          return (
            <label
              key={opt.position}
              className={cn(
                'flex min-h-6 cursor-pointer items-start gap-2 rounded-lg py-1 text-left text-xs-plus',
                noneOfTheAbove && 'opacity-40',
                isReadOnly && 'cursor-not-allowed opacity-60',
              )}
            >
              {isReviewTurn ? (
                <input
                  type="radio"
                  name={`review-action-${id}`}
                  checked={isSelected}
                  onChange={() => toggleSelection(opt.position)}
                  disabled={isReadOnly}
                  aria-label={opt.content}
                />
              ) : (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(opt.position)}
                  disabled={isReadOnly}
                  aria-label={opt.content}
                  className="mt-px shrink-0 data-checked:border-[#1060d6] data-checked:bg-[#2070e6]"
                />
              )}
              <span className={isSelected ? 'text-ink' : 'text-sub'}>{opt.content}</span>
              {opt.is_recommended && <span className="text-xxs font-medium text-[#2070e6]">Recommended</span>}
            </label>
          );
        })}

        {!isReviewTurn && (
          <>
            <div className="my-1 border-t border-rule" />
            <label className="flex min-h-6 cursor-pointer items-start gap-2 rounded-lg py-1 text-left text-xs-plus">
              <Checkbox
                checked={noneOfTheAbove}
                onCheckedChange={toggleNone}
                disabled={isReadOnly}
                className="mt-px shrink-0 data-checked:border-[#1060d6] data-checked:bg-[#2070e6]"
              />
              <span className={cn('text-sub', noneOfTheAbove && 'text-ink')}>
                None of the above / I'm not sure
              </span>
            </label>
          </>
        )}
      </div>

      {isSubmitted ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          data-testid="turn-processing-state"
        >
          Interviewer is processing this response.
        </div>
      ) : null}

      <div className="-mx-4 -mb-4 border-t border-rule bg-white px-4 pt-3">
        <label className="text-xs text-sub" htmlFor={`turn-response-${id}`}>
          {reviewSet ? 'Review note' : 'Please provide additional context for your answer.'}
        </label>
        <Textarea
          id={`turn-response-${id}`}
          aria-label={reviewSet ? 'Review note' : 'Additional response context'}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          disabled={isReadOnly}
          placeholder={
            reviewSet
              ? 'Optional note explaining requested changes or confirming acceptance'
              : 'Constraints, trade-offs, motivations, or reasoning worth capturing…'
          }
          className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 pb-5 pt-2 text-sm-plus text-ink placeholder:text-hint focus-visible:ring-0"
        />
      </div>
    </>
  );

  return (
    <>
      <DrawerCard header={header} defaultExpanded locked>
        {body}
      </DrawerCard>

      {!isSubmitted && (
        <div className="mt-3 flex items-center justify-between">
          <ShellButton variant="ghost" disabled={isReadOnly} onClick={onBack}>
            Back
          </ShellButton>
          <div className="flex items-center gap-2">
            <ShellButton variant="ghost" disabled={isReadOnly} onClick={onSkip}>
              Skip
            </ShellButton>
            <ShellButton
              variant="primary"
              disabled={isReadOnly || !canSubmit}
              onClick={() => onSubmitResponse?.(selectedPositions, freeText.trim() || undefined)}
            >
              Submit
            </ShellButton>
          </div>
        </div>
      )}
    </>
  );
}

// ── Question card skeleton ──────────────────────────────────────────

export function QuestionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint shadow-[var(--shadow-card)]">
      <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20 bg-wash" />
          <Skeleton className="h-5 w-3/4 bg-wash" />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <Skeleton className="h-3 w-full bg-wash" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-2/3 bg-wash" />
          <Skeleton className="h-4 w-1/2 bg-wash" />
          <Skeleton className="h-4 w-3/5 bg-wash" />
        </div>
        <Skeleton className="h-16 w-full bg-wash" />
      </div>
    </div>
  );
}

// ── Generating state container ──────────────────────────────────────

export function GeneratingTurnPlaceholder() {
  const startTimeRef = useRef<number>(Date.now());
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col" data-testid="generating-turn-placeholder">
      <ActivityPlaceholder seconds={seconds > 0 ? seconds : undefined} />
      <QuestionCardSkeleton />
    </div>
  );
}
