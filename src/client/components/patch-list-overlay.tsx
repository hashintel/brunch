// PatchListOverlay — the canonical persistent patch-list surface (SIDE_CHAT.md §4).
//
// Renders sticky bars below the global app top-bar:
//   • Staged-changes bar when there are staged patches.
//   • Pending-review section listing open reconciliation_need rows (V3.0 card 2,
//     SIDE_CHAT.md §5.3 — driven by useSpecificationOpenReconciliationNeeds).
//   • Saved-toast for soft / none / hard impact applies (transient post-apply).
//
// Lives outside the side-chat popover so it stays visible regardless of whether
// the panel is open — V4's architect loop will deposit into the same surface.

import { useEffect, useRef, useState } from 'react';

import { useSpecificationOpenReconciliationNeeds } from '@/client/routes/specification/$id/-specification-data.js';

import { ContentDiff } from './content-diff.js';
import { ImpactChip } from './impact-chip.js';
import { kindAccentHex } from './knowledge-card';
import { useLastBatchAppliedMeta, usePatchList, usePatchListState } from './patch-list-host.js';
import { usePatchListOverlayBridge } from './patch-list-overlay-bridge.js';
import type { Patch } from './patch-list-reducer.js';
import { usePatchListUndoOverride } from './patch-list-undo-context.js';

const MESSAGE_DURATION_MS = 5000;

function lastBatchHasNonNullApply(meta: ReadonlyArray<{ patchId: string; applied: unknown }>): boolean {
  for (const entry of meta) {
    if (entry.applied) {
      return true;
    }
  }
  return false;
}

function StagedPatchDetailRow({ patch }: { patch: Patch }): React.ReactElement {
  const showDiff =
    patch.kind === 'edit' &&
    typeof patch.currentContent === 'string' &&
    patch.currentContent !== patch.newContent;
  const kindAccent = kindAccentHex[patch.anchor.kind];
  const impact = patch.kind === 'edit' ? patch.impact : undefined;
  return (
    <li
      data-staged-patch-id={patch.id}
      data-staged-patch-kind={patch.kind}
      className="flex flex-col gap-1.5 rounded-md bg-background px-3 py-2"
    >
      <div className="flex items-center gap-2">
        {patch.anchorReferenceCode ? (
          <span
            data-staged-patch-anchor={patch.anchorReferenceCode}
            className="inline-flex shrink-0 items-center rounded-[4px] px-1.5 py-0.5 font-mono text-[11px] font-medium"
            style={{ backgroundColor: `${kindAccent}14`, color: kindAccent }}
          >
            {patch.anchorReferenceCode}
          </span>
        ) : null}
        <span className="flex-1 truncate text-ink" title={patch.summary}>
          {patch.summary}
        </span>
        {impact ? <ImpactChip impact={impact} /> : null}
      </div>
      {showDiff ? (
        <div className="border-l border-rule pl-2">
          <ContentDiff before={patch.currentContent ?? ''} after={patch.newContent} />
        </div>
      ) : null}
    </li>
  );
}

export function PatchListOverlay(): React.ReactElement | null {
  const patchList = usePatchList();
  const state = usePatchListState();
  const lastBatchAppliedMeta = useLastBatchAppliedMeta();
  const undoOverride = usePatchListUndoOverride();
  const overlayBridge = usePatchListOverlayBridge();
  const openNeeds = useSpecificationOpenReconciliationNeeds();

  const stagedCount = state.staged.length;
  const openNeedsCount = openNeeds.length;

  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastSeenBatchIdRef = useRef<string | null>(null);

  // Auto-collapse when there are no staged patches left (post-apply / undo).
  useEffect(() => {
    if (stagedCount === 0 && expanded) {
      setExpanded(false);
    }
  }, [stagedCount, expanded]);

  // Drive transient-message state off lastBatchId transitions: a new batch
  // means a fresh apply just landed.
  //
  // Deps are intentionally narrow: a wider dep array re-runs cleanup on
  // unrelated churn (e.g. stagedCount change), cancelling the auto-hide
  // timer and leaving the toast stuck on screen.
  useEffect(() => {
    if (state.lastBatchId === null || state.lastBatchId === lastSeenBatchIdRef.current) {
      return;
    }
    lastSeenBatchIdRef.current = state.lastBatchId;

    const hasApply = lastBatchHasNonNullApply(lastBatchAppliedMeta);

    if (hasApply && !state.isApplying && stagedCount === 0 && state.canUndo) {
      setSavedToastVisible(true);
      const handle = window.setTimeout(() => setSavedToastVisible(false), MESSAGE_DURATION_MS);
      return () => window.clearTimeout(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastBatchId]);

  // Hide transient post-apply toast when canUndo flips back to false (the user undid).
  useEffect(() => {
    if (!state.canUndo) {
      setSavedToastVisible(false);
    }
  }, [state.canUndo]);

  if (!patchList) {
    return null;
  }

  const undo = undoOverride ?? (() => void patchList.undo());

  const scopedApplyBlocked =
    overlayBridge !== null && stagedCount > 0 && overlayBridge.scopedPatchIds.length === 0;

  function applyFromOverlay() {
    if (overlayBridge) {
      overlayBridge.applyScoped();
      return;
    }
    void patchList.apply();
  }

  // Nothing to surface: no staged patches, no open needs, no transient toast.
  if (stagedCount === 0 && openNeedsCount === 0 && !savedToastVisible) {
    return null;
  }

  const countLabel = `${stagedCount} pending change${stagedCount === 1 ? '' : 's'}`;

  return (
    <div className="sticky top-0 z-30 flex flex-col">
      {stagedCount > 0 ? (
        <div
          role="region"
          aria-label="Staged changes"
          data-staged-count={stagedCount}
          data-expanded={expanded ? 'true' : 'false'}
          className="border-b border-rule bg-card/95 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-1.5 text-xs">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 font-medium text-ink outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
            >
              <span
                aria-hidden
                className={`font-mono text-[10px] text-hint transition-transform ${expanded ? 'rotate-90' : ''}`}
              >
                ›
              </span>
              <span>{countLabel}</span>
            </button>
          <div className="flex items-center gap-1.5">
            {state.canUndo ? (
              <button
                type="button"
                onClick={undo}
                className="rounded-md bg-white px-2 py-0.5 text-xs text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              disabled={state.isApplying || scopedApplyBlocked}
              title={
                scopedApplyBlocked
                  ? 'Pending changes are on another item — open that item in side-chat or switch context to apply them'
                  : undefined
              }
              onClick={() => void applyFromOverlay()}
              className="rounded-md bg-[linear-gradient(180deg,#3484fa,#2070e6)] px-2 py-0.5 text-xs font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-[#1060d6] disabled:opacity-50"
            >
              {state.isApplying ? 'Applying…' : 'Apply'}
            </button>
          </div>
          </div>
          {expanded ? (
            <ul
              role="list"
              aria-label="Staged patch detail"
              className="flex flex-col gap-1.5 border-t border-rule bg-wash/40 px-4 py-2"
            >
              {state.staged.map((patch) => (
                <StagedPatchDetailRow key={patch.id} patch={patch} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {openNeedsCount > 0 ? (
        <div
          role="region"
          aria-label="Pending review"
          data-open-needs-count={openNeedsCount}
          className="flex flex-col gap-1 border-b border-rule bg-[rgba(255,219,168,0.35)] px-4 py-1.5 text-xs backdrop-blur"
        >
          <span className="font-medium text-ink">
            {openNeedsCount} pending review{openNeedsCount === 1 ? '' : 's'}
          </span>
          <ul className="text-text-sub flex flex-col gap-0.5">
            {openNeeds.map((need) => (
              <li
                key={need.id}
                data-need-id={need.id}
                data-need-kind={need.kind}
                className="flex items-center gap-2"
              >
                <span
                  className="rounded-sm bg-white/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink uppercase"
                  data-kind-chip={need.kind}
                >
                  {need.kind === 'supersedes' ? 'supersedes' : 'confirm'}
                </span>
                <span>
                  source #{need.source_item_id} → target #{need.target_item_id}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {savedToastVisible ? (
        <div
          role="status"
          aria-label="Change saved"
          className="flex items-center justify-between gap-3 border-b border-rule bg-card/95 px-4 py-1.5 text-xs backdrop-blur"
        >
          <span className="font-medium text-ink">Change saved</span>
          {state.canUndo ? (
            <button
              type="button"
              onClick={undo}
              className="rounded-md bg-white px-2 py-0.5 text-xs text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
