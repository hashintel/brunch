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

import { resolveReconciliationNeedRequest } from '@/client/lib/edit-api.js';
import {
  invalidateOpenReconciliationNeeds,
  useSpecificationOpenReconciliationNeeds,
} from '@/client/routes/specification/$id/-specification-data.js';

import { ContentDiff } from './content-diff.js';

export function PendingReviewSection(): React.ReactElement | null {
  const openNeeds = useSpecificationOpenReconciliationNeeds();
  const [resolvingNeedIds, setResolvingNeedIds] = useState<ReadonlySet<number>>(() => new Set());

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
          // Card 2 (V3.1 setup): render the source diff inline when both
          // snapshots are present. ContentDiff returns null when before ===
          // after, so a no-op edit silently collapses to no diff block. The
          // "Source change" label is gated on the same condition so it stays
          // out of the way for legacy / no-change rows.
          const showSourceDiff =
            need.source_previous_content !== null && need.source_current_content !== null;
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
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={() => handleResolve(need.id, need.specification_id)}
                  className="rounded-md bg-white px-2 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa] disabled:opacity-50"
                >
                  {isResolving ? 'Resolving…' : 'Resolve'}
                </button>
              </div>
              {showSourceDiff ? (
                <ContentDiff
                  before={need.source_previous_content ?? ''}
                  after={need.source_current_content ?? ''}
                  label="Source change"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
