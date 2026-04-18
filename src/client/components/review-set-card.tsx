import { Check } from 'lucide-react';

import { Button } from '@/client/components/ui/button';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';
import type { ReviewAction } from '@/shared/api-types.js';

export type ReviewSetGroundingRef = {
  code: string;
};

export type ReviewSetCardItem = {
  content: string;
  referenceCode?: string | null;
  rationale?: string | null;
  grounding?: readonly ReviewSetGroundingRef[];
  isUserCreated?: boolean;
  isRevised?: boolean;
};

export type ReviewSetCardData = {
  title: string;
  items: readonly ReviewSetCardItem[];
};

function getReviewSetItemKey(item: ReviewSetCardItem): string {
  return item.referenceCode ?? item.content;
}

function ReviewSetItemRow({ item }: { item: ReviewSetCardItem }) {
  const grounding = item.grounding ?? [];

  return (
    <div className="flex gap-3 rounded-xl border border-rule bg-white px-4 py-4 shadow-[var(--shadow-card)]">
      <span className="w-14 shrink-0 pt-0.5 font-mono text-xs font-medium text-hint">
        {item.referenceCode ?? '—'}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm leading-relaxed text-ink">{item.content}</p>
        {item.rationale ? <p className="text-xs leading-relaxed text-sub">{item.rationale}</p> : null}
        {grounding.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {grounding.map((ref) => (
              <span
                key={ref.code}
                className="inline-flex h-5 items-center rounded-md bg-wash px-1.5 font-mono text-[11px] font-medium text-sub"
              >
                {ref.code}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ReviewPhaseCompletionCard({
  title,
  description,
  cta,
  onContinue,
}: {
  title: string;
  description: string;
  cta: string;
  onContinue?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-wash p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(22,163,106,0.1)]">
          <Check className="size-3.5 text-[#16a34a]" />
        </div>
        <p className="text-sm font-medium text-ink">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-sub">{description}</p>
      {onContinue ? (
        <Button className="mt-3" variant="outline" onClick={onContinue}>
          {cta}
        </Button>
      ) : null}
    </div>
  );
}

export function ReviewSetCard({
  reviewSet,
  description,
  note,
  onNoteChange,
  onAccept,
  onRequestChanges,
  disabled,
  submitted,
  resolvedAction,
}: {
  reviewSet: ReviewSetCardData;
  description: string;
  note: string;
  onNoteChange: (note: string) => void;
  onAccept: () => void;
  onRequestChanges: () => void;
  disabled: boolean;
  submitted: boolean;
  initialComments?: Record<string, string>;
  resolvedAction?: ReviewAction | null;
}) {
  const hasAnyFeedback = note.trim().length > 0;

  return (
    <div className="flex flex-col gap-4" data-testid="review-set-card">
      <div className="overflow-hidden rounded-xl border border-rule bg-white p-5">
        <h3 className="text-base font-medium text-ink">{reviewSet.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-sub">{description}</p>
      </div>

      <div className="flex flex-col gap-3">
        {reviewSet.items.map((item) => {
          const itemKey = getReviewSetItemKey(item);

          return <ReviewSetItemRow key={itemKey} item={item} />;
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-sub">Review note</span>
        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Overall feedback on the review set…"
          disabled={disabled}
          className="min-h-20 rounded-xl border-rule text-sm"
          aria-label="Review note"
        />
      </div>

      {submitted ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          data-testid="turn-processing-state"
        >
          Interviewer is processing this response.
        </div>
      ) : resolvedAction ? (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            resolvedAction === 'accept'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100',
          )}
          data-testid="review-set-resolution"
        >
          {resolvedAction === 'accept' ? 'Review accepted.' : 'Changes requested.'}
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          {hasAnyFeedback ? (
            <>
              <Button variant="outline" onClick={onAccept} disabled={disabled}>
                <Check data-icon="inline-start" />
                Accept Review
              </Button>
              <Button onClick={onRequestChanges} disabled={disabled}>
                Request Changes
              </Button>
            </>
          ) : (
            <Button onClick={onAccept} disabled={disabled}>
              <Check data-icon="inline-start" />
              Accept Review
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
