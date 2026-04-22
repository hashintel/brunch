import { Check, MessageSquare } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { Button } from '@/client/components/app-shell';
import { Button as ShadcnButton } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';
import type { ReviewAction } from '@/shared/api-types.js';
import { getReviewItemIdentity } from '@/shared/review-diffing.js';

export type ReviewSetGroundingRef = {
  code: string;
};

export type ReviewSetCardItem = {
  reviewItemId: string;
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
  return getReviewItemIdentity(item);
}

function StatsBar({ total, grounding, commented }: { total: number; grounding: number; commented?: number }) {
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
      {commented !== undefined ? (
        <div className="flex flex-col">
          <span className={cn('text-lg font-medium', commented > 0 ? 'text-[#d97706]' : 'text-ink')}>
            {commented}
          </span>
          <span className="text-xs text-hint">Commented</span>
        </div>
      ) : null}
    </div>
  );
}

function ReviewSetItemRow({
  item,
  comment,
  onCommentChange,
  disabled,
  showItemComments,
}: {
  item: ReviewSetCardItem;
  comment: string;
  onCommentChange: (comment: string) => void;
  disabled: boolean;
  showItemComments: boolean;
}) {
  const grounding = item.grounding ?? [];
  const hasComment = comment.trim().length > 0;
  const itemLabel = item.referenceCode ?? item.content;
  const itemIdentity = getReviewSetItemKey(item);

  return (
    <Collapsible>
      <div
        className={cn(
          'relative z-[1] flex items-start gap-3 border-b border-rule bg-white px-4 py-3 shadow-[var(--shadow-card)]',
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
              Added in revision
            </span>
          ) : null}
          {item.isRevised ? (
            <span className="inline-flex h-5 items-center rounded-md bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-600">
              Revised
            </span>
          ) : null}

          {showItemComments ? (
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
          ) : null}
        </div>
      </div>

      {showItemComments ? (
        <CollapsibleContent>
          <div className="border-b border-rule bg-tint px-4 pt-3">
            <label className="text-xs text-sub" htmlFor={`review-set-comment-${itemIdentity}`}>
              Comment
            </label>
            <Textarea
              id={`review-set-comment-${itemIdentity}`}
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Add a revision note for this item…"
              disabled={disabled}
              className="min-h-16 resize-none rounded-none border-0 bg-transparent px-0 pt-2 pb-3 text-sm text-ink placeholder:text-hint focus-visible:ring-0"
            />
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export function ReviewPhaseCompletionCard({
  eyebrow,
  title,
  description,
  cta,
  onContinue,
  action,
  testId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cta?: string;
  onContinue?: () => void;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="border-t border-[rgba(22,163,74,0.25)] py-3"
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(22,163,74,0.12)]">
          <Check className="size-3.5 text-[#16a34a]" />
        </div>
        <div className="flex flex-col">
          <p className="text-xxs text-hint">{eyebrow}</p>
          <h2 className="mt-0.5 text-sm font-medium text-ink">{title}</h2>
          <p className="mt-1 text-xs-plus leading-relaxed text-sub">{description}</p>
          {action ? (
            <div className="mt-3">{action}</div>
          ) : onContinue && cta ? (
            <Button className="mt-3" variant="outline" size="sm" onClick={onContinue}>
              {cta}
            </Button>
          ) : null}
        </div>
      </div>
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
  resolvedAction,
  showItemComments = false,
  revisionNumber,
}: {
  reviewSet: ReviewSetCardData;
  description: string;
  note: string;
  onNoteChange: (note: string) => void;
  onAccept: () => void;
  onRequestChanges: (itemComments: Array<{ reviewItemId: string; comment: string }>) => void;
  disabled: boolean;
  submitted: boolean;
  initialComments?: Record<string, string>;
  resolvedAction?: ReviewAction | null;
  showItemComments?: boolean;
  revisionNumber?: number;
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
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-ink">{reviewSet.title}</h3>
          {revisionNumber !== undefined ? (
            <span className="inline-flex h-5 items-center rounded-md bg-wash px-1.5 text-[11px] font-medium text-sub">
              v{revisionNumber}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-sub">{description}</p>
        <div className="mt-4">
          <StatsBar
            total={reviewSet.items.length}
            grounding={totalGrounding}
            commented={showItemComments ? commentedCount : undefined}
          />
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
              showItemComments={showItemComments}
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
              <ShadcnButton variant="outline" onClick={onAccept} disabled={disabled}>
                <Check data-icon="inline-start" />
                Accept Review
              </ShadcnButton>
              <ShadcnButton
                onClick={() => {
                  const itemComments: Array<{ reviewItemId: string; comment: string }> = [];
                  for (const item of reviewSet.items) {
                    const comment = commentsByItem[getReviewSetItemKey(item)]?.trim();
                    if (comment) {
                      itemComments.push({ reviewItemId: item.reviewItemId, comment });
                    }
                  }
                  onRequestChanges(itemComments);
                }}
                disabled={disabled}
              >
                Request Changes
              </ShadcnButton>
            </>
          ) : (
            <ShadcnButton onClick={onAccept} disabled={disabled}>
              <Check data-icon="inline-start" />
              Accept Review
            </ShadcnButton>
          )}
        </div>
      )}
    </div>
  );
}
