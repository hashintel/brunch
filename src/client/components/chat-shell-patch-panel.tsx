import { Undo2, X } from 'lucide-react';

import { cn } from '@/client/lib/utils.js';

import { Task, TaskContent, TaskItem, TaskTrigger } from './ai-elements/task.js';
import { ContentDiff } from './content-diff.js';
import { ImpactChip } from './impact-chip.js';
import { usePatchList, usePatchListState } from './patch-list-host.js';
import type { Patch } from './patch-list-reducer.js';

export interface ChatShellPatchPanelProps {
  /**
   * When true, surfaces the panel as actively running so it auto-opens; on
   * transition to false the underlying `<Task>` auto-closes after its
   * built-in `AUTO_CLOSE_DELAY`. Optional; callers without a global
   * streaming signal can omit it and rely on `defaultOpen=true` to surface
   * staged patches as soon as they arrive.
   */
  readonly isStreaming?: boolean;
}

/**
 * Shell-level patch panel. Replaces the workspace-wide `<PatchListOverlay>`
 * surface with one inline panel that lives inside `<UnifiedChatShell>` and
 * surfaces the union of every chat's staged patches. Apply is bulk-only at
 * the header; per-row action is Discard. Renders `null` when nothing is
 * staged so the empty-state collapses cleanly.
 *
 * Visual posture: neutral by default. Per-row kind / anchor labels render as
 * plain hint-colored text (no per-kind accent) so the panel reads as part of
 * the shell's monochrome vocabulary; the only chromatic accent is the
 * `<ImpactChip>`, which is reused as-is so impact stays legible across the
 * app. The Apply control reuses the composer-send dark button so primary
 * actions throughout the shell share one shape.
 */
export function ChatShellPatchPanel({
  isStreaming = false,
}: ChatShellPatchPanelProps = {}): React.ReactElement | null {
  const actions = usePatchList();
  const state = usePatchListState();

  const count = state.staged.length;
  // Stay mounted while Undo is reachable so post-apply users can reverse the
  // batch — mirrors the overlay's behaviour where the saved-toast carried the
  // Undo affordance for ~5s. The panel still renders nothing when there are
  // no staged patches AND no batch to undo, so empty-state collapses cleanly.
  if (!actions || (count === 0 && !state.canUndo)) {
    return null;
  }

  const title = count === 0 ? 'Change applied' : `${count} pending change${count === 1 ? '' : 's'}`;

  return (
    <Task
      data-testid="chat-shell-patch-panel"
      data-staged-count={count}
      isRunning={isStreaming}
      defaultOpen
      className="rounded-lg border border-rule bg-tint/40 px-2 py-1.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <TaskTrigger title={title} collapsible={count > 0} className="w-auto flex-1" />
        <div className="flex items-center gap-1.5">
          {state.canUndo ? (
            <button
              type="button"
              data-testid="chat-shell-patch-undo"
              onClick={() => {
                void actions.undo();
              }}
              aria-label="Undo last applied change"
              className="inline-flex items-center gap-1 rounded-md border border-rule bg-background px-1.5 py-0.5 text-xs text-hint hover:bg-tint hover:text-ink"
            >
              <Undo2 aria-hidden className="size-3" />
              <span>Undo</span>
            </button>
          ) : null}
          {count > 0 ? (
            <button
              type="button"
              data-testid="chat-shell-patch-apply-all"
              disabled={state.isApplying}
              onClick={() => {
                void actions.apply();
              }}
              aria-label={`Apply all ${count} change${count === 1 ? '' : 's'}`}
              className={cn(
                'inline-flex items-center rounded-md bg-[#202020] px-2 py-0.5 text-xs font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_0_1px_#101010] hover:enabled:bg-[#000] disabled:bg-[#e3e3e3] disabled:text-[#a6a6a6] disabled:shadow-none',
              )}
            >
              {state.isApplying ? 'Applying…' : 'Apply all'}
            </button>
          ) : null}
        </div>
      </div>
      {count > 0 ? (
        <TaskContent className="text-foreground">
          <ul className="flex flex-col gap-1.5" role="list" aria-label="Staged changes">
            {state.staged.map((patch) => (
              <ChatShellPatchRow key={patch.id} patch={patch} onDiscard={() => actions.discard(patch.id)} />
            ))}
          </ul>
        </TaskContent>
      ) : null}
    </Task>
  );
}

function ChatShellPatchRow({ patch, onDiscard }: { patch: Patch; onDiscard: () => void }) {
  const showDiff =
    patch.kind === 'edit' &&
    typeof patch.currentContent === 'string' &&
    patch.currentContent !== patch.newContent;
  const impact = patch.kind === 'edit' ? patch.impact : undefined;
  return (
    <li
      data-testid="chat-shell-patch-row"
      data-staged-patch-id={patch.id}
      data-staged-patch-kind={patch.kind}
      className="flex flex-col gap-1 rounded-md bg-background px-2 py-1.5"
    >
      <div className="flex items-center gap-1.5">
        <span data-testid="chat-shell-patch-kind" className="font-mono text-[10px] text-hint uppercase">
          {patch.kind}
        </span>
        {patch.anchorReferenceCode ? (
          <span
            data-staged-patch-anchor={patch.anchorReferenceCode}
            className="shrink-0 font-mono text-[10px] text-hint"
          >
            {patch.anchorReferenceCode}
          </span>
        ) : null}
        <TaskItem className="min-w-0 flex-1 truncate text-foreground" title={patch.summary}>
          {patch.summary}
        </TaskItem>
        {impact ? <ImpactChip impact={impact} /> : null}
        <button
          type="button"
          data-testid="chat-shell-patch-discard"
          onClick={onDiscard}
          aria-label={`Discard staged change: ${patch.summary}`}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded text-hint hover:bg-tint hover:text-ink"
        >
          <X aria-hidden className="size-3" />
        </button>
      </div>
      {showDiff ? (
        <div
          data-testid="chat-shell-patch-diff"
          className="rounded border border-rule/60 bg-wash/40 p-1.5 text-[11px]"
        >
          <ContentDiff before={patch.currentContent ?? ''} after={patch.newContent} />
        </div>
      ) : null}
    </li>
  );
}
