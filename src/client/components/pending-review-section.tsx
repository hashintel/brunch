// PendingReviewSection — V3.0 cascade resolution surface (SIDE_CHAT.md §5.3).
//
// Renders open `reconciliation_need` rows for the current specification with
// a per-row Resolve button. Driven by useSpecificationOpenReconciliationNeeds;
// returns null when the queue is empty so the parent overlay can skip rendering.
//
// V3.1 will add agent grouping (auto-confirm / auto-edit / substantive) and a
// substantive-walk surface; that work expands inside this component without
// affecting the patch-list-overlay's other regions.

import { useState } from 'react';

import { editKnowledgeItemRequest, resolveReconciliationNeedRequest } from '@/client/lib/edit-api.js';
import {
  invalidateOpenReconciliationNeeds,
  useSpecificationOpenReconciliationNeeds,
} from '@/client/routes/specification/$id/-specification-data.js';

import { ContentDiff } from './content-diff.js';

// Card 3 (V3.1 setup): per-row inline edit state. Keyed by need id so
// expanding one row's edit form doesn't perturb other rows. Draft text is
// the current textarea value; absence from the map means the row is not
// in edit mode. Saving runs editKnowledgeItemRequest then the existing
// resolve endpoint, so re-entrant cascades (a hard apply opening new needs)
// surface in the same Pending review section after the next refetch.
type EditDraftMap = ReadonlyMap<number, string>;

export function PendingReviewSection(): React.ReactElement | null {
  const openNeeds = useSpecificationOpenReconciliationNeeds();
  const [resolvingNeedIds, setResolvingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [editDrafts, setEditDrafts] = useState<EditDraftMap>(() => new Map());
  const [savingNeedIds, setSavingNeedIds] = useState<ReadonlySet<number>>(() => new Set());

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

  return (
    <div
      role="region"
      aria-label="Pending review"
      data-open-needs-count={openNeeds.length}
      className="sticky top-0 z-30 flex flex-col gap-1 border-b border-rule bg-[rgba(255,219,168,0.35)] px-4 py-1.5 text-xs backdrop-blur"
    >
      <span className="font-medium text-ink">
        {openNeeds.length} pending review{openNeeds.length === 1 ? '' : 's'}
      </span>
      <ul className="text-text-sub flex flex-col gap-1.5">
        {openNeeds.map((need) => {
          const isResolving = resolvingNeedIds.has(need.id);
          const isSaving = savingNeedIds.has(need.id);
          const draft = editDrafts.get(need.id);
          const isEditing = draft !== undefined;
          // Card 2 (V3.1 setup): render the source diff inline when both
          // snapshots are present. ContentDiff returns null when before ===
          // after, so a no-op edit silently collapses to no diff block. The
          // "Source change" label is gated on the same condition so it stays
          // out of the way for legacy / no-change rows.
          const showSourceDiff =
            need.source_previous_content !== null && need.source_current_content !== null;
          // Card 3 (V3.1 setup): the Edit-target affordance is only shown
          // when the listing endpoint surfaced live target content. Hidden
          // when null (e.g. target was deleted between fetch and render);
          // user can still close the row via Resolve.
          const canEditTarget = need.target_current_content !== null;
          return (
            <li
              key={need.id}
              data-need-id={need.id}
              data-need-kind={need.kind}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className="rounded-sm bg-white/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink uppercase"
                    data-kind-chip={need.kind}
                  >
                    {need.kind === 'supersedes' ? 'supersedes' : 'confirm'}
                  </span>
                  <span>
                    source #{need.source_item_id} → target #{need.target_item_id}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  {canEditTarget && !isEditing ? (
                    <button
                      type="button"
                      disabled={isResolving || isSaving}
                      onClick={() => startEditing(need.id, need.target_current_content ?? '')}
                      className="rounded-md bg-white px-2 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa] disabled:opacity-50"
                    >
                      Edit target
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isResolving || isSaving}
                    onClick={() => handleResolve(need.id, need.specification_id)}
                    className="rounded-md bg-white px-2 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa] disabled:opacity-50"
                  >
                    {isResolving ? 'Resolving…' : 'Resolve'}
                  </button>
                </span>
              </div>
              {showSourceDiff ? (
                <ContentDiff
                  before={need.source_previous_content ?? ''}
                  after={need.source_current_content ?? ''}
                  label="Source change"
                />
              ) : null}
              {isEditing ? (
                <div data-edit-target-form className="flex flex-col gap-1">
                  <textarea
                    aria-label={`Edit target for need ${need.id}`}
                    value={draft}
                    disabled={isSaving}
                    onChange={(event) => updateDraft(need.id, event.target.value)}
                    className="min-h-[3.5rem] w-full rounded-md border border-rule bg-white px-2 py-1 text-[11px] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.04)] focus:border-[#3484fa] focus:outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => cancelEditing(need.id)}
                      className="rounded-md bg-white px-2 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSave(need.id, need.specification_id, need.target_item_id)}
                      className="rounded-md bg-[#3484fa] px-2 py-0.5 text-[11px] text-white shadow-[0_0_0_1px_rgba(52,132,250,0.3)] hover:bg-[#1f6dd6] disabled:opacity-50"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
