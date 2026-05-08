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

import { useLastBatchAppliedMeta, usePatchList, usePatchListState } from './patch-list-host.js';
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

export function PatchListOverlay(): React.ReactElement | null {
  const patchList = usePatchList();
  const state = usePatchListState();
  const lastBatchAppliedMeta = useLastBatchAppliedMeta();
  const undoOverride = usePatchListUndoOverride();

  const stagedCount = state.staged.length;

  const [deferredBanner, setDeferredBanner] = useState<DeferredBanner | null>(null);
  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const lastSeenBatchIdRef = useRef<string | null>(null);

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

  // Nothing to surface: no staged patches, no transient message.
  if (stagedCount === 0 && !deferredBanner && !savedToastVisible) {
    return null;
  }

  if (stagedCount > 0) {
    return (
      <div
        role="region"
        aria-label="Staged changes"
        data-staged-count={stagedCount}
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-rule bg-card/95 px-4 py-1.5 text-xs backdrop-blur"
      >
        <span className="font-medium text-ink">
          {stagedCount} pending change{stagedCount === 1 ? '' : 's'}
        </span>
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
            disabled={state.isApplying}
            onClick={() => void patchList.apply()}
            className="rounded-md bg-[linear-gradient(180deg,#3484fa,#2070e6)] px-2 py-0.5 text-xs font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-[#1060d6] disabled:opacity-50"
          >
            {state.isApplying ? 'Applying…' : 'Apply'}
          </button>
        </div>
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
