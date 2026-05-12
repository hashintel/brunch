import { useEffect, useRef, useState } from 'react';

import { ContentDiff } from './content-diff.js';
import { ImpactChip } from './impact-chip.js';
import { kindAccentHex } from './knowledge-card';
import {
  useLastBatchAppliedMeta,
  usePatchList,
  usePatchListSavedToastLastAckBatchIdRef,
  usePatchListState,
} from './patch-list-host.js';
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

  const stagedCount = state.staged.length;

  const [savedToastVisible, setSavedToastVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastSeenBatchIdRef = usePatchListSavedToastLastAckBatchIdRef();
  const prevCanUndoRef = useRef<boolean>(state.canUndo);

  useEffect(() => {
    if (stagedCount === 0 && expanded) {
      setExpanded(false);
    }
  }, [stagedCount, expanded]);

  useEffect(() => {
    const batchAdvanced = state.lastBatchId !== null && state.lastBatchId !== lastSeenBatchIdRef.current;

    if (batchAdvanced) {
      lastSeenBatchIdRef.current = state.lastBatchId;
    }

    const hasApply = lastBatchHasNonNullApply(lastBatchAppliedMeta);
    const showFromBatch =
      batchAdvanced &&
      hasApply &&
      !state.isApplying &&
      state.staged.length === 0;

    const canUndoDropped = prevCanUndoRef.current && !state.canUndo;
    prevCanUndoRef.current = state.canUndo;

    if (showFromBatch) {
      setSavedToastVisible(true);
      const handle = window.setTimeout(() => setSavedToastVisible(false), MESSAGE_DURATION_MS);
      return () => window.clearTimeout(handle);
    }

    if (canUndoDropped && !batchAdvanced) {
      setSavedToastVisible(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- staged length read only with batch/canUndo transitions that follow apply; omitting `state.staged` avoids timer churn on stage
  }, [state.lastBatchId, state.canUndo, state.isApplying, lastBatchAppliedMeta]);

  if (!patchList) {
    return null;
  }

  const undo = undoOverride ?? (() => void patchList.undo());

  const scopedApplyBlocked =
    overlayBridge !== null && stagedCount > 0 && overlayBridge.scopedPatchIds.length === 0;

  const applyFromOverlay = (): void => {
    if (overlayBridge) {
      overlayBridge.applyScoped();
      return;
    }
    void patchList.apply();
  };

  if (stagedCount === 0 && !savedToastVisible) {
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
          className="border-b border-rule bg-card/95"
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
                onClick={() => applyFromOverlay()}
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
      {savedToastVisible ? (
        <div
          role="status"
          aria-label="Change saved"
          className="flex animate-in items-center justify-between gap-3 border-b border-rule bg-card/95 px-4 py-1.5 text-xs duration-200 fade-in slide-in-from-top-1"
        >
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span
              aria-hidden
              className="inline-flex size-3.5 animate-in items-center justify-center rounded-full bg-emerald-500 text-white duration-200 zoom-in"
            >
              <svg
                viewBox="0 0 12 12"
                className="size-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M2.5 6.5l2.25 2.25L9.5 3.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Change saved
          </span>
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
