import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Impact, ReviewAction } from '@/shared/api-types.js';
import type { ActivitySummary, GroundingCardData } from '@/shared/chat.js';
import type { ReviewSetChangeSummary } from '@/shared/review-diffing.js';
import { getPersistedReviewAction, getPersistedTurnResponse } from '@/shared/specification-state.js';
import type { SpecificationTurn } from '@/shared/specification.js';

import { cn } from '../lib/utils';
import { ThinkingTokenScroll } from './ai-elements/thinking-token-scroll';
import { Button } from './app-shell';
import { DrawerCard } from './drawer-card';
import { isVisibleKnowledgeKind } from './knowledge-display';
import { ReviewSetCard, type ReviewSetCardData } from './review-set-card';
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
  turn: SpecificationTurn;
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
  const isFreeTextOnly = !turn.options || turn.options.length === 0;
  const chosenSummary = isFreeTextOnly
    ? null
    : selectedPositions.length > 0
      ? selectedPositions.join(', ')
      : persistedResponse?.freeText
        ? 'None'
        : turn.answer?.trim() || '—';
  const responseContext = persistedResponse?.freeText?.trim() || turn.answer?.trim() || null;
  const capturedItems = (turn.captured_items ?? []).filter((item) => isVisibleKnowledgeKind(item.kind));
  const displayCaptureStatus: 'done' | 'trailing' =
    captureStatus === 'waiting' || captureStatus === 'applying' ? 'trailing' : 'done';
  const impact = turn.impact ?? 'low';

  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-row items-center justify-between gap-2.5 text-[12px]">
        <span className={cn('font-medium', impactColor[impact])}>
          {impact[0]!.toUpperCase() + impact.slice(1)} Impact
        </span>
        <span className="-m-0.5 flex h-5 shrink-0 items-center justify-center gap-1 rounded-full bg-[rgba(22,163,106,0.1)] px-2 text-[11px] text-[#16a34a]">
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
        {isFreeTextOnly ? (
          <div className="min-w-0 grow">
            <span className="block truncate text-sub">
              Response: <span className="text-sub italic">"{responseContext ?? '—'}"</span>
            </span>
          </div>
        ) : (
          <>
            <span className="text-sub">Choices:</span>
            <span className="text-ink">{chosenSummary}</span>
            {responseContext && (
              <>
                <span className="shrink-0 text-rule">|</span>
                <div className="min-w-0 grow">
                  <span className="block truncate text-sub">
                    Context: <span className="text-sub italic">"{responseContext}"</span>
                  </span>
                </div>
              </>
            )}
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
              className="inline-flex h-5 items-center rounded bg-wash px-1.5 text-[11px] leading-none font-medium text-sub"
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

export function AnsweredReviewSetCard({
  turn,
  reviewSet,
  revisionNumber,
}: {
  turn: SpecificationTurn;
  reviewSet: ReviewSetCardData;
  revisionNumber?: number;
}) {
  const persistedResponse = getPersistedTurnResponse(turn);

  return (
    <div data-testid="answered-review-set-card">
      <ReviewSetCard
        reviewSet={reviewSet}
        description={turn.why ?? turn.question}
        note={persistedResponse?.freeText?.trim() ?? ''}
        onNoteChange={() => {}}
        onAccept={() => {}}
        onRequestChanges={() => {}}
        disabled
        submitted={false}
        resolvedAction={getPersistedReviewAction(turn)}
        revisionNumber={revisionNumber}
      />
    </div>
  );
}

export function AnsweredGroundingCard({
  groundingCard,
  turn,
}: {
  groundingCard: GroundingCardData;
  turn: SpecificationTurn;
}) {
  const persistedResponse = getPersistedTurnResponse(turn);
  const note = persistedResponse?.freeText?.trim() ?? '';

  return (
    <div data-testid="answered-grounding-card">
      <DrawerCard
        locked
        header={
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-[#2070e6] uppercase">Grounding</span>
            <p className="text-sm-plus font-medium tracking-[-0.015em] text-ink">{groundingCard.summary}</p>
          </div>
        }
        summary={
          <div className="flex flex-col gap-2 text-xs-plus text-sub">
            {groundingCard.detail ? <p className="leading-relaxed text-sub">{groundingCard.detail}</p> : null}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-sub">Note:</span>
              <span className={note ? 'text-ink' : 'text-hint'}>{note || 'None'}</span>
            </div>
          </div>
        }
      />
    </div>
  );
}

export function CollapsedReviewCard({
  revisionNumber,
  reviewAction,
}: {
  revisionNumber: number;
  reviewAction: 'accept' | 'request-changes';
}) {
  return (
    <div
      data-testid="collapsed-review-card"
      className="flex items-center gap-3 rounded-lg border border-rule bg-white px-4 py-2.5"
    >
      <span className="inline-flex h-5 items-center rounded-md bg-wash px-1.5 text-[11px] font-medium text-sub">
        v{revisionNumber}
      </span>
      <span className="text-xs text-sub">
        {reviewAction === 'accept' ? 'Review accepted' : 'Changes requested'}
      </span>
    </div>
  );
}

function formatChangeSummary(changeSummary: ReviewSetChangeSummary): string {
  const parts: string[] = [];
  if (changeSummary.revised > 0) parts.push(`${changeSummary.revised} revised`);
  if (changeSummary.added > 0) parts.push(`${changeSummary.added} added`);
  if (changeSummary.removed > 0) parts.push(`${changeSummary.removed} removed`);
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

export function RevisionCard({
  revisionNumber,
  changeSummary,
}: {
  revisionNumber: number;
  changeSummary: ReviewSetChangeSummary;
}) {
  return (
    <div
      data-testid="revision-card"
      className="flex items-center gap-3 rounded-xl border border-rule bg-tint px-4 py-3"
    >
      <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
        v{revisionNumber}
      </span>
      <span className="text-xs text-sub">{formatChangeSummary(changeSummary)}</span>
    </div>
  );
}

export function ActiveGroundingCard({
  groundingCard,
  onSubmitResponse,
  persistedFreeText,
  hasPersistedResponse,
  disabled,
  state,
  continuePosition,
}: {
  groundingCard: GroundingCardData;
  onSubmitResponse?: (positions: number[], freeText?: string) => void | Promise<void>;
  persistedFreeText: string;
  hasPersistedResponse: boolean;
  disabled: boolean;
  state: 'active' | 'submitted';
  continuePosition: number | undefined;
}) {
  const [note, setNote] = useState(persistedFreeText);
  const isSubmitted = state === 'submitted';
  const isReadOnly = disabled || hasPersistedResponse || isSubmitted || continuePosition === undefined;
  const continueLabel = groundingCard.continueLabel?.trim() || 'Continue';

  useEffect(() => {
    if (!hasPersistedResponse) {
      return;
    }

    setNote(persistedFreeText);
  }, [hasPersistedResponse, persistedFreeText]);

  return (
    <div data-testid="active-grounding-card">
      <DrawerCard
        locked
        defaultExpanded
        header={
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-[#2070e6] uppercase">Grounding</span>
            <p className="text-[17px] leading-[1.4] font-medium tracking-[-0.015em] text-ink">
              {groundingCard.summary}
            </p>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {groundingCard.detail ? (
            <p className="text-xs-plus leading-relaxed text-sub">{groundingCard.detail}</p>
          ) : null}

          {isSubmitted ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
              data-testid="turn-processing-state"
            >
              Interviewer is processing this grounding note.
            </div>
          ) : null}

          <div className="-mx-4 -mb-4 border-t border-rule bg-white px-4 pt-3">
            <label className="text-xs text-sub" htmlFor="grounding-card-note">
              Add an optional note before continuing.
            </label>
            <Textarea
              id="grounding-card-note"
              aria-label="Grounding card note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isReadOnly}
              placeholder="Missing context, caveats, or feature-area corrections worth carrying forward…"
              className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 pt-2 pb-5 text-sm-plus text-ink placeholder:text-hint focus-visible:ring-0"
            />
          </div>
        </div>
      </DrawerCard>

      {!isSubmitted ? (
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            disabled={isReadOnly}
            onClick={() => onSubmitResponse?.([continuePosition!], note.trim() || undefined)}
          >
            {continueLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ActiveReviewSetCard({
  onSubmitReviewAction,
  persistedFreeText,
  hasPersistedResponse,
  disabled,
  state,
  reviewSet,
  question,
  why,
  revisionNumber,
}: {
  onSubmitReviewAction?: (
    reviewAction: ReviewAction,
    freeText?: string,
    itemComments?: Array<{ reviewItemId: string; comment: string }>,
  ) => void | Promise<void>;
  persistedFreeText: string;
  hasPersistedResponse: boolean;
  disabled: boolean;
  state: 'active' | 'submitted';
  reviewSet: ReviewSetCardData;
  question: string;
  why: string | null;
  revisionNumber?: number;
}) {
  const [note, setNote] = useState(persistedFreeText);
  const isSubmitted = state === 'submitted';
  const isReadOnly = disabled || hasPersistedResponse || isSubmitted;

  useEffect(() => {
    if (!hasPersistedResponse) {
      return;
    }

    setNote(persistedFreeText);
  }, [hasPersistedResponse, persistedFreeText]);

  function submitReviewAction(
    reviewAction: ReviewAction,
    itemComments?: Array<{ reviewItemId: string; comment: string }>,
  ) {
    if (isReadOnly) {
      return;
    }

    void onSubmitReviewAction?.(
      reviewAction,
      note.trim() || undefined,
      itemComments?.length ? itemComments : undefined,
    );
  }

  return (
    <div data-testid="active-review-set-card">
      <ReviewSetCard
        reviewSet={reviewSet}
        description={why ?? question}
        note={note}
        onNoteChange={setNote}
        onAccept={() => submitReviewAction('accept')}
        onRequestChanges={(itemComments) => submitReviewAction('request-changes', itemComments)}
        disabled={isReadOnly}
        submitted={isSubmitted}
        showItemComments
        revisionNumber={revisionNumber}
      />
    </div>
  );
}

// ── Active question card ────────────────────────────────────────────

type TurnCardOption = Pick<
  NonNullable<SpecificationTurn['options']>[number],
  'position' | 'content' | 'is_recommended'
>;

export function ActiveQuestionCard({
  id,
  questionCode,
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
}: {
  id: string;
  questionCode?: string;
  question: string;
  why: string | null;
  impact: SpecificationTurn['impact'];
  options: readonly TurnCardOption[];
  onSubmitResponse?: (positions: number[], freeText?: string) => void | Promise<void>;
  onBack?: () => void;
  onSkip?: () => void;
  persistedSelectedPositions: number[];
  persistedFreeText: string;
  hasPersistedResponse: boolean;
  disabled: boolean;
  state: 'active' | 'submitted';
}) {
  const [selectedPositions, setSelectedPositions] = useState<number[]>(persistedSelectedPositions);
  const [freeText, setFreeText] = useState(persistedFreeText);
  const [noneOfTheAbove, setNoneOfTheAbove] = useState(false);
  const isFreeTextOnly = options.length === 0;
  const hasSelection = selectedPositions.length > 0;
  const hasFreeText = freeText.trim().length > 0;
  const canSubmit = isFreeTextOnly ? hasFreeText : hasSelection || (noneOfTheAbove && hasFreeText);
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
      current.includes(position) ? current.filter((value) => value !== position) : [...current, position],
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
      <div className="flex items-baseline gap-2.5">
        {questionCode && <span className="shrink-0 text-[17px] font-medium text-hint">{questionCode}</span>}
        <p className="text-[17px] leading-[1.4] font-medium tracking-[-0.015em] text-ink">{question}</p>
      </div>
    </div>
  );

  const body = (
    <>
      {why && <p className="text-xs leading-relaxed text-sub">{why}</p>}

      {!isFreeTextOnly && (
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
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(opt.position)}
                  disabled={isReadOnly}
                  aria-label={opt.content}
                  className="mt-px shrink-0 data-checked:border-[#1060d6] data-checked:bg-[#2070e6]"
                />
                <span className={isSelected ? 'text-ink' : 'text-sub'}>{opt.content}</span>
                {opt.is_recommended && (
                  <span className="text-xxs font-medium text-[#2070e6]">Recommended</span>
                )}
              </label>
            );
          })}

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
        </div>
      )}

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
          {isFreeTextOnly ? 'Your response' : 'Please provide additional context for your answer.'}
        </label>
        <Textarea
          id={`turn-response-${id}`}
          aria-label={isFreeTextOnly ? 'Your response' : 'Additional response context'}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          disabled={isReadOnly}
          placeholder={
            isFreeTextOnly
              ? 'Share your thinking — goals, context, constraints, or anything relevant…'
              : 'Constraints, trade-offs, motivations, or reasoning worth capturing…'
          }
          className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 pt-2 pb-5 text-sm-plus text-ink placeholder:text-hint focus-visible:ring-0"
        />
      </div>
    </>
  );

  return (
    <div data-testid="active-question-card">
      <DrawerCard header={header} defaultExpanded locked>
        {body}
      </DrawerCard>

      {!isSubmitted && (
        <div className="mt-3 flex items-center justify-between">
          <Button variant="ghost" disabled={isReadOnly} onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={isReadOnly} onClick={onSkip}>
              Skip
            </Button>
            <Button
              variant="primary"
              disabled={isReadOnly || !canSubmit}
              onClick={() => onSubmitResponse?.(selectedPositions, freeText.trim() || undefined)}
            >
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
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

export function GeneratingTurnPlaceholder({
  liveActivity,
  liveReasoningText,
}: {
  liveActivity?: ActivitySummary;
  liveReasoningText?: string;
}) {
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
      <ActivityPlaceholder seconds={seconds > 0 ? seconds : undefined} tools={liveActivity?.tools} />
      {liveReasoningText && <ThinkingTokenScroll text={liveReasoningText} className="mt-1" />}
      <QuestionCardSkeleton />
    </div>
  );
}
