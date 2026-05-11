// PendingReviewSection — V3.0 cascade resolution surface (SIDE_CHAT.md §5.3).
//
// Renders open `reconciliation_need` rows for the current specification with
// a per-row Resolve button. Driven by useSpecificationOpenReconciliationNeeds;
// returns null when the queue is empty so the parent overlay can skip rendering.
//
// V3.1 will add agent grouping (auto-confirm / auto-edit / substantive) and a
// substantive-walk surface; that work expands inside this component without
// affecting the patch-list-overlay's other regions.
//
// Card 4 polish: source diff is no longer rendered inline. Each row shows a
// "↗ view source diff" chip that opens a <DiffPopover>. Action buttons shrink
// to icon-only ghost (Edit) + small kind-accent solid (Resolve). The inline
// edit form reuses the same toolbar contract as ItemEditTextarea (icon-only
// Cancel + small kind-accent Save). Until the listing endpoint is enriched
// with target_item_kind, the row left bar and Resolve fill use a neutral
// amber as a kind-accent fallback (deferred follow-up card).

import { Check, Loader2, PencilLine, Replace, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { editKnowledgeItemRequest, resolveReconciliationNeedRequest } from '@/client/lib/edit-api.js';
import {
  invalidateOpenReconciliationNeeds,
  useSpecificationOpenReconciliationNeeds,
} from '@/client/routes/specification/$id/-specification-data.js';

import { DiffPopover } from './diff-popover.js';

// Card 3 (V3.1 setup): per-row inline edit state. Keyed by need id so
// expanding one row's edit form doesn't perturb other rows. Draft text is
// the current textarea value; absence from the map means the row is not
// in edit mode. Saving runs editKnowledgeItemRequest then the existing
// resolve endpoint, so re-entrant cascades (a hard apply opening new needs)
// surface in the same Pending review section after the next refetch.
type EditDraftMap = ReadonlyMap<number, string>;

// Card 4 follow-up: only the kind-relevant chips/bar carry an amber tint
// (they signal supersedes/confirm semantics). Action buttons (Resolve, Edit,
// Save) use the product's primary blue so non-kind affordances don't bleed
// into the amber row family.
const KIND_ACCENT_AMBER = '#d97706';
const PRIMARY_ACTION_BLUE = '#3484fa';

const TARGET_EXCERPT_LIMIT = 80;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function PendingReviewSection(): React.ReactElement | null {
  const openNeeds = useSpecificationOpenReconciliationNeeds();
  const [resolvingNeedIds, setResolvingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [editDrafts, setEditDrafts] = useState<EditDraftMap>(() => new Map());
  const [savingNeedIds, setSavingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  // Card 4 / S3: which row's source-diff popover is open, anchored to its
  // chip. Single-popover-at-a-time is intentional — opening another row's
  // chip closes the previous one.
  const [diffPopoverNeedId, setDiffPopoverNeedId] = useState<number | null>(null);
  const diffAnchorRef = useRef<HTMLButtonElement | null>(null);

  if (openNeeds.length === 0) {
    return null;
  }

  // Idempotent resolve. The button is disabled while the request is in flight
  // so a double-click can't double-fire. Errors propagate; we don't optimistically
  // remove the row before the server confirms.
  const handleResolve = (needId: number, specificationId: number): void => {
    setResolvingNeedIds((prev) => {
      const next = new Set(prev);
      next.add(needId);
      return next;
    });
    void (async () => {
      try {
        await resolveReconciliationNeedRequest(specificationId, needId);
        await invalidateOpenReconciliationNeeds(specificationId);
      } catch (error) {
        console.error(`Resolve reconciliation_need ${needId} failed`, error);
      } finally {
        setResolvingNeedIds((prev) => {
          const next = new Set(prev);
          next.delete(needId);
          return next;
        });
      }
    })();
  };

  const startEditing = (needId: number, currentContent: string): void => {
    setEditDrafts((prev) => {
      const next = new Map(prev);
      next.set(needId, currentContent);
      return next;
    });
  };

  const cancelEditing = (needId: number): void => {
    setEditDrafts((prev) => {
      const next = new Map(prev);
      next.delete(needId);
      return next;
    });
  };

  const updateDraft = (needId: number, value: string): void => {
    setEditDrafts((prev) => {
      const next = new Map(prev);
      next.set(needId, value);
      return next;
    });
  };

  // Save sequences edit → resolve → invalidate so the row leaves the
  // Pending review section atomically from the user's POV. If the edit
  // itself triggers a hard cascade (impact === 'hard'), the new needs
  // appear in the same section after invalidation; the resolve still
  // closes THIS need.
  const handleSave = (needId: number, specificationId: number, targetItemId: number): void => {
    const draft = editDrafts.get(needId);
    if (draft === undefined) return;
    setSavingNeedIds((prev) => {
      const next = new Set(prev);
      next.add(needId);
      return next;
    });
    void (async () => {
      try {
        await editKnowledgeItemRequest(specificationId, targetItemId, { content: draft });
        await resolveReconciliationNeedRequest(specificationId, needId);
        await invalidateOpenReconciliationNeeds(specificationId);
        cancelEditing(needId);
      } finally {
        setSavingNeedIds((prev) => {
          const next = new Set(prev);
          next.delete(needId);
          return next;
        });
      }
    })();
  };

  const activePopoverNeed = diffPopoverNeedId
    ? (openNeeds.find((n) => n.id === diffPopoverNeedId) ?? null)
    : null;

  return (
    <div
      role="region"
      aria-label="Pending review"
      data-open-needs-count={openNeeds.length}
      className="flex flex-col gap-1 border-b border-rule bg-[rgba(255,219,168,0.18)] px-6 py-2 text-xs"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        <Replace className="size-3.5" style={{ color: KIND_ACCENT_AMBER }} aria-hidden />
        {openNeeds.length} pending review{openNeeds.length === 1 ? '' : 's'}
      </span>
      <ul className="text-text-sub flex flex-col gap-0.5">
        {openNeeds.map((need) => {
          const isResolving = resolvingNeedIds.has(need.id);
          const isSaving = savingNeedIds.has(need.id);
          const draft = editDrafts.get(need.id);
          const isEditing = draft !== undefined;
          const showSourceDiff =
            need.source_previous_content !== null &&
            need.source_current_content !== null &&
            need.source_previous_content !== need.source_current_content;
          const canEditTarget = need.target_current_content !== null;
          // Kind chip + left bar carry amber (the kind-relevant signal).
          // Action buttons (Resolve, Save) and the inline edit form border
          // use the product's primary blue so non-kind chrome doesn't bleed
          // amber into action affordances.
          const kindAccent = KIND_ACCENT_AMBER;
          const actionAccent = PRIMARY_ACTION_BLUE;
          const KindIcon = need.kind === 'supersedes' ? Replace : Check;
          const kindLabel = need.kind === 'supersedes' ? 'supersedes' : 'confirm';
          const targetExcerpt =
            need.target_current_content !== null
              ? truncate(need.target_current_content, TARGET_EXCERPT_LIMIT)
              : null;
          return (
            <li
              key={need.id}
              data-need-id={need.id}
              data-need-kind={need.kind}
              className="group/need-row flex gap-2 rounded px-1.5 py-1"
            >
              <span
                aria-hidden
                className="w-0.5 shrink-0 self-stretch rounded-full"
                style={{ backgroundColor: 'rgba(255,219,168,0.6)' }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                      style={{ backgroundColor: `${kindAccent}14`, color: kindAccent }}
                      data-kind-chip={need.kind}
                    >
                      <KindIcon className="size-3" aria-hidden />
                      {kindLabel}
                    </span>
                    <span className="min-w-0 truncate text-ink" title={targetExcerpt ?? undefined}>
                      <span className="font-mono text-hint">#{need.target_item_id}</span>
                      {targetExcerpt !== null ? (
                        <>
                          <span className="mx-1 text-hint">·</span>
                          {targetExcerpt}
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEditTarget && !isEditing ? (
                      <button
                        type="button"
                        aria-label={`Edit target for need ${need.id}`}
                        title="Edit target"
                        disabled={isResolving || isSaving}
                        onClick={() => startEditing(need.id, need.target_current_content ?? '')}
                        className="inline-flex size-6 items-center justify-center rounded text-hint opacity-60 group-hover/need-row:opacity-100 hover:bg-[rgba(0,0,0,0.05)] hover:text-ink hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                      >
                        <PencilLine className="size-3.5" aria-hidden />
                        <span className="sr-only">Edit target</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={isResolving ? 'Resolving' : 'Resolve'}
                      title="Resolve"
                      disabled={isResolving || isSaving}
                      onClick={() => handleResolve(need.id, need.specification_id)}
                      className="inline-flex size-6 items-center justify-center rounded text-white opacity-80 transition-opacity group-hover/need-row:opacity-100 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                      style={{ backgroundColor: actionAccent }}
                    >
                      {isResolving ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-3.5" aria-hidden strokeWidth={2.5} />
                      )}
                      <span className="sr-only">{isResolving ? 'Resolving' : 'Resolve'}</span>
                    </button>
                  </div>
                </div>
                {showSourceDiff ? (
                  <div className="flex items-center gap-2 text-[11px] text-hint">
                    <span>from #{need.source_item_id} was edited</span>
                    <button
                      type="button"
                      aria-label={`View source diff for need ${need.id}`}
                      data-view-source-diff-chip
                      onClick={(event) => {
                        diffAnchorRef.current = event.currentTarget;
                        setDiffPopoverNeedId(need.id);
                      }}
                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium hover:bg-[rgba(0,0,0,0.04)] hover:text-ink"
                      style={
                        diffPopoverNeedId === need.id
                          ? { backgroundColor: `${kindAccent}14`, color: kindAccent }
                          : undefined
                      }
                    >
                      ↗ view source diff
                    </button>
                  </div>
                ) : null}
                {isEditing ? (
                  <div
                    data-edit-target-form
                    className="mt-1 flex flex-col gap-1.5 rounded-md p-2"
                    style={{
                      backgroundColor: `${actionAccent}10`,
                      boxShadow: `inset 0 0 0 1px ${actionAccent}1f`,
                    }}
                  >
                    <textarea
                      aria-label={`Edit target for need ${need.id}`}
                      value={draft}
                      disabled={isSaving || isResolving}
                      onChange={(event) => updateDraft(need.id, event.target.value)}
                      className="min-h-[3.5rem] w-full resize-y rounded bg-background px-2 py-1 text-[12px] leading-relaxed text-ink outline-none shadow-[inset_0_0_0_1px_var(--edit-ring-color)] focus:shadow-[inset_0_0_0_2px_var(--edit-ring-strong)] disabled:opacity-50"
                      style={
                        {
                          '--edit-ring-color': `${actionAccent}1f`,
                          '--edit-ring-strong': `${actionAccent}33`,
                        } as React.CSSProperties
                      }
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label="Cancel"
                        title="Cancel"
                        disabled={isSaving || isResolving}
                        onClick={() => cancelEditing(need.id)}
                        className="inline-flex size-6 items-center justify-center rounded text-hint hover:bg-[rgba(0,0,0,0.05)] hover:text-ink disabled:opacity-50"
                      >
                        <X className="size-3.5" aria-hidden />
                        <span className="sr-only">Cancel</span>
                      </button>
                      <button
                        type="button"
                        aria-label={isSaving ? 'Saving' : 'Save'}
                        title="Save"
                        disabled={isSaving || isResolving}
                        onClick={() => handleSave(need.id, need.specification_id, need.target_item_id)}
                        className="inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: actionAccent }}
                      >
                        {isSaving ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                        ) : (
                          <Check className="size-3" aria-hidden strokeWidth={2.5} />
                        )}
                        {isSaving ? 'Saving' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {activePopoverNeed &&
      activePopoverNeed.source_previous_content !== null &&
      activePopoverNeed.source_current_content !== null ? (
        <DiffPopover
          open
          onClose={() => {
            setDiffPopoverNeedId(null);
            diffAnchorRef.current = null;
          }}
          anchor={diffAnchorRef.current}
          before={activePopoverNeed.source_previous_content}
          after={activePopoverNeed.source_current_content}
          title={`Source change · #${activePopoverNeed.source_item_id}`}
          kindAccent={KIND_ACCENT_AMBER}
        />
      ) : null}
    </div>
  );
}
