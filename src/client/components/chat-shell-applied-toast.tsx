import { Check, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { usePatchList, usePatchListState } from './patch-list-host.js';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion.js';

const AUTO_DISMISS_MS = 5000;

export function ChatShellAppliedToast(): React.ReactElement | null {
  const actions = usePatchList();
  const state = usePatchListState();
  const prefersReducedMotion = usePrefersReducedMotion();

  // The toast surfaces whenever the most recent applied batch is still
  // undoable. The user can either Undo, manually dismiss with the X button,
  // or let it auto-dismiss after 5s.
  const eligible = actions !== null && state.canUndo && state.staged.length === 0;
  const lastBatchId = state.lastBatchId;
  const [dismissedBatchId, setDismissedBatchId] = useState<string | null>(null);
  const visible = eligible && lastBatchId !== null && dismissedBatchId !== lastBatchId;

  useEffect(() => {
    if (!visible || lastBatchId === null) return;
    const timer = window.setTimeout(() => {
      setDismissedBatchId(lastBatchId);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [visible, lastBatchId]);

  const lastBatchIsAllAnnotate =
    state.lastBatchPatches.length > 0 && state.lastBatchPatches.every((patch) => patch.kind === 'annotate');
  const label = lastBatchIsAllAnnotate ? 'Note added' : 'Change applied';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="chat-shell-applied-toast"
          data-testid="chat-shell-applied-toast"
          data-applied-kind={lastBatchIsAllAnnotate ? 'note' : 'change'}
          role="status"
          aria-live="polite"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto mx-auto inline-flex w-fit max-w-full items-center gap-2 self-center rounded-full border border-rule/40 bg-background px-3 py-1 text-[11px] text-sub shadow-md"
        >
          <span className="inline-flex items-center gap-1.5">
            <Check aria-hidden className="size-3 text-emerald-500" strokeWidth={2.5} />
            <span>{label}</span>
          </span>
          <button
            type="button"
            data-testid="chat-shell-applied-toast-undo"
            onClick={() => void actions?.undo()}
            aria-label="Undo last applied change"
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-ink transition-[transform,background-color] duration-150 hover:bg-tint active:scale-95"
          >
            <Undo2 aria-hidden className="size-3" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            data-testid="chat-shell-applied-toast-dismiss"
            onClick={() => setDismissedBatchId(lastBatchId)}
            aria-label="Dismiss notification"
            className="inline-flex size-4 items-center justify-center rounded-full text-hint transition-[transform,background-color,color] duration-150 hover:bg-tint hover:text-ink active:scale-95"
          >
            <X aria-hidden className="size-3" strokeWidth={1.75} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
