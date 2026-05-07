// PatchListOverlay — the canonical persistent patch-list surface (SIDE_CHAT.md §4).
//
// Renders a sticky bar below the global app top-bar whenever there are staged
// patches or a transient post-apply message to surface. Lives outside the
// side-chat popover so it stays visible regardless of whether the panel is open
// — this is the surface V4's architect loop will eventually deposit into too.
//
// Two transient-message cases share this overlay:
//   • saved-toast for soft / none impact applies (mirrors the popover's
//     existing "Change saved" toast but works even with the panel closed)
//   • deferred-banner for V2 hard-impact applies (per SIDE_CHAT.md §6.3:
//     "Hard impact — coming in V3 cascade preview"). The deferred-applied
//     marker carried in lastBatchAppliedMeta drives this; the popover's
//     saved-toast is suppressed for deferred-only batches via prop.

import { useEffect, useRef, useState } from 'react';

import { ContentDiff } from './content-diff.js';
import { useLastBatchAppliedMeta, usePatchList, usePatchListState } from './patch-list-host.js';
import { usePatchListOverlayBridge } from './patch-list-overlay-bridge.js';
import type { Patch } from './patch-list-reducer.js';
import { usePatchListUndoOverride } from './patch-list-undo-context.js';

const MESSAGE_DURATION_MS = 5000;

interface DeferredBanner {
  message: string;
}

function readDeferredFromAppliedMeta(applied: unknown): DeferredBanner | null {
  if (!applied || typeof applied !== 'object') {
    return null;
  }
  const record = applied as { deferred?: unknown; message?: unknown };
  if (record.deferred !== true) {
    return null;
  }
  const message =
    typeof record.message === 'string' ? record.message : 'Hard impact — coming in V3 cascade preview';
  return { message };
}

function lastBatchHasDeferred(
  meta: ReadonlyArray<{ patchId: string; applied: unknown }>,
): DeferredBanner | null {
  for (const entry of meta) {
    const banner = readDeferredFromAppliedMeta(entry.applied);
    if (banner) {
      return banner;
    }
  }
  return null;
}

function lastBatchHasNonDeferredApply(meta: ReadonlyArray<{ patchId: string; applied: unknown }>): boolean {
  for (const entry of meta) {
    if (readDeferredFromAppliedMeta(entry.applied) === null && entry.applied) {
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
  return (
    <li
      data-staged-patch-id={patch.id}
      data-staged-patch-kind={patch.kind}
      className="flex flex-col gap-1.5 rounded-md bg-background px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-ink" title={patch.summary}>
          {patch.summary}
        </span>
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

  const stagedCount = state.staged.length;

  const [deferredBanner, setDeferredBanner] = useState<DeferredBanner | null>(null);
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
  // timer and leaving the banner stuck on screen.
  useEffect(() => {
    if (state.lastBatchId === null || state.lastBatchId === lastSeenBatchIdRef.current) {
      return;
    }
    lastSeenBatchIdRef.current = state.lastBatchId;

    const banner = lastBatchHasDeferred(lastBatchAppliedMeta);
    const hasNonDeferred = lastBatchHasNonDeferredApply(lastBatchAppliedMeta);

    if (banner) {
      setDeferredBanner(banner);
      setSavedToastVisible(false);
      const handle = window.setTimeout(() => setDeferredBanner(null), MESSAGE_DURATION_MS);
      return () => window.clearTimeout(handle);
    }

    setDeferredBanner(null);
    if (hasNonDeferred && !state.isApplying && stagedCount === 0 && state.canUndo) {
      setSavedToastVisible(true);
      const handle = window.setTimeout(() => setSavedToastVisible(false), MESSAGE_DURATION_MS);
      return () => window.clearTimeout(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastBatchId]);

  // Hide transient post-apply messages when canUndo flips back to false (the user undid).
  useEffect(() => {
    if (!state.canUndo) {
      setDeferredBanner(null);
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

  // Nothing to surface: no staged patches, no transient message.
  if (stagedCount === 0 && !deferredBanner && !savedToastVisible) {
    return null;
  }

  if (stagedCount > 0) {
    const countLabel = `${stagedCount} pending change${stagedCount === 1 ? '' : 's'}`;
    return (
      <div
        role="region"
        aria-label="Staged changes"
        data-staged-count={stagedCount}
        data-expanded={expanded ? 'true' : 'false'}
        className="sticky top-0 z-30 border-b border-rule bg-card/95 backdrop-blur"
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
    );
  }

  if (deferredBanner) {
    return (
      <div
        role="status"
        aria-label="Hard impact deferred to V3"
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-rule bg-[rgba(255,219,168,0.5)] px-4 py-1.5 text-xs backdrop-blur"
      >
        <span className="font-medium text-ink">{deferredBanner.message}</span>
        <button
          type="button"
          onClick={() => setDeferredBanner(null)}
          className="rounded-md bg-white px-2 py-0.5 text-xs text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (savedToastVisible) {
    return (
      <div
        role="status"
        aria-label="Change saved"
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-rule bg-card/95 px-4 py-1.5 text-xs backdrop-blur"
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
    );
  }

  return null;
}
