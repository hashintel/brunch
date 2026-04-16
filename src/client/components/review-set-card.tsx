import { Check, MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

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

function StatsBar({ total, grounding, commented }: { total: number; grounding: number; commented: number }) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col">
        <span className="text-lg font-medium text-ink">{total}</span>
        <span className="text-xs text-hint">Items</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-medium text-ink">{grounding}</span>
        <span className="text-xs text-hint">Grounding</span>
      </div>
      <div className="flex flex-col">
        <span className={cn('text-lg font-medium', commented > 0 ? 'text-[#d97706]' : 'text-ink')}>
          {commented}
        </span>
        <span className="text-xs text-hint">Commented</span>
      </div>
    </div>
  );
}

function ReviewSetItemRow({
  item,
  comment,
  onCommentChange,
  disabled,
}: {
  item: ReviewSetCardItem;
  comment: string;
  onCommentChange: (comment: string) => void;
  disabled: boolean;
}) {
  const hasComment = comment.trim().length > 0;
  const grounding = item.grounding ?? [];
  const itemLabel = item.referenceCode ?? item.content;

  return (
    <Collapsible>
      <div
        className={cn(
          'relative z-[1] flex items-start gap-3 border-b border-rule bg-white px-4 py-3 shadow-[var(--shadow-card)]',
          item.isRevised && 'bg-[rgba(37,99,235,0.03)]',
        )}
      >
        <span className="w-14 shrink-0 pt-0.5 font-mono text-xs font-medium text-hint">
          {item.referenceCode ?? '—'}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm text-ink">{item.content}</p>
          {item.rationale ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-sub">{item.rationale}</p>
          ) : null}
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

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {item.isUserCreated ? (
            <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
              Added by you
            </span>
          ) : null}
          {item.isRevised ? (
            <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
              Revised
            </span>
          ) : null}

          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md hover:bg-wash"
              aria-label={`Comment on ${itemLabel}`}
              disabled={disabled}
            >
              <MessageSquare
                className={cn('size-4', hasComment ? 'fill-[#d97706]/15 text-[#d97706]' : 'text-hint')}
              />
            </button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-b border-rule bg-tint px-4 pt-3">
          <label className="text-xs text-sub" htmlFor={`review-set-comment-${itemLabel}`}>
            Comment
          </label>
          <Textarea
            id={`review-set-comment-${itemLabel}`}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Add a revision note for this item…"
            disabled={disabled}
            className="min-h-16 resize-none rounded-none border-0 bg-transparent px-0 pt-2 pb-3 text-sm text-ink placeholder:text-hint focus-visible:ring-0"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
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
  initialComments,
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
}) {
  const [commentsByItem, setCommentsByItem] = useState<Record<string, string>>(initialComments ?? {});
  const totalGrounding = useMemo(
    () => reviewSet.items.reduce((sum, item) => sum + (item.grounding?.length ?? 0), 0),
    [reviewSet.items],
  );
  const commentedCount = useMemo(
    () => Object.values(commentsByItem).filter((comment) => comment.trim().length > 0).length,
    [commentsByItem],
  );
  const hasAnyFeedback = commentedCount > 0 || note.trim().length > 0;

  return (
    <div className="flex flex-col gap-4" data-testid="review-set-card">
      <div className="overflow-hidden rounded-xl border border-rule bg-white p-5">
        <h3 className="text-base font-medium text-ink">{reviewSet.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-sub">{description}</p>
        <div className="mt-4">
          <StatsBar total={reviewSet.items.length} grounding={totalGrounding} commented={commentedCount} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-[var(--shadow-card-ring)]">
        {reviewSet.items.map((item) => {
          const itemKey = getReviewSetItemKey(item);

          return (
            <ReviewSetItemRow
              key={itemKey}
              item={item}
              comment={commentsByItem[itemKey] ?? ''}
              onCommentChange={(comment) =>
                setCommentsByItem((current) => ({
                  ...current,
                  [itemKey]: comment,
                }))
              }
              disabled={disabled}
            />
          );
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
