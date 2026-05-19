import { ArrowDownToDot, Check, NotebookPen, Pencil, Play, Spline, X } from 'lucide-react';

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
 * Inline patch panel inside <UnifiedChatShell> showing the union of every chat's
 * staged patches. Apply is bulk-only at the header; per-row action is Discard.
 * Returns null when nothing is staged.
 */
export function ChatShellPatchPanel({
  isStreaming = false,
}: ChatShellPatchPanelProps = {}): React.ReactElement | null {
  const actions = usePatchList();
  const state = usePatchListState();

  const count = state.staged.length;
  if (!actions || count === 0) {
    return null;
  }

  const title =
    count === 1
      ? `1 ${state.staged[0]!.kind === 'edit' ? 'edit' : state.staged[0]!.kind === 'edge' ? 'connection' : state.staged[0]!.kind === 'drill-down' ? 'drill-down' : 'note'}`
      : `${count} changes`;

  return (
    <Task
      data-testid="chat-shell-patch-panel"
      data-staged-count={count}
      isRunning={isStreaming}
      defaultOpen
      className="rounded-lg border border-rule/30 px-2 py-1.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <TaskTrigger title={title} collapsible className="w-auto flex-1" />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="chat-shell-patch-apply-all"
            disabled={state.isApplying}
            onClick={() => {
              void actions.apply();
            }}
            aria-label={`Apply all ${count} change${count === 1 ? '' : 's'}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sub transition-[background-color,color,transform] duration-150 hover:enabled:bg-tint hover:enabled:text-ink active:enabled:scale-95 disabled:text-hint"
          >
            <Check aria-hidden className="size-3" strokeWidth={1.75} />
            {state.isApplying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
      <TaskContent className="text-foreground">
        <ul className="flex flex-col gap-1.5" role="list" aria-label="Staged changes">
          {state.staged.map((patch) => (
            <ChatShellPatchRow key={patch.id} patch={patch} onDiscard={() => actions.discard(patch.id)} />
          ))}
        </ul>
      </TaskContent>
    </Task>
  );
}

function ChatShellPatchRow({ patch, onDiscard }: { patch: Patch; onDiscard: () => void }) {
  const showDiff =
    patch.kind === 'edit' &&
    typeof patch.currentContent === 'string' &&
    patch.currentContent !== patch.newContent;
  const impact = patch.kind === 'edit' ? patch.impact : undefined;
  const isEdit = patch.kind === 'edit';
  const KindIcon =
    patch.kind === 'edit'
      ? Pencil
      : patch.kind === 'edge'
        ? Spline
        : patch.kind === 'drill-down'
          ? ArrowDownToDot
          : NotebookPen;
  return (
    <li
      data-testid="chat-shell-patch-row"
      data-staged-patch-id={patch.id}
      data-staged-patch-kind={patch.kind}
      className="flex flex-col gap-1 rounded-md px-2 py-1"
    >
      <div className="flex items-center gap-1.5">
        <KindIcon aria-hidden className="size-3 shrink-0 text-hint" strokeWidth={1.5} />
        {impact ? <ImpactChip impact={impact} /> : null}
        <TaskItem className="min-w-0 flex-1 truncate text-foreground" title={patch.summary}>
          {patch.summary}
        </TaskItem>
        <span data-testid="chat-shell-patch-kind" className="sr-only">
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
        {isEdit ? (
          <button
            type="button"
            data-testid="chat-shell-patch-run-agent"
            aria-label={`Run agent on: ${patch.summary}`}
            title="Run agent"
            onClick={() => {
              // TODO: wire to agent rerun pipeline; affordance is here so the
              // user can discover the action while we land the backend route.
            }}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-hint transition-[transform,background-color,color] duration-150 hover:bg-tint/60 hover:text-ink active:scale-95"
          >
            <Play aria-hidden className="size-3" strokeWidth={1.5} />
          </button>
        ) : null}
        <button
          type="button"
          data-testid="chat-shell-patch-discard"
          onClick={onDiscard}
          aria-label={`Discard staged change: ${patch.summary}`}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-hint transition-[transform,background-color,color] duration-150 hover:bg-tint/60 hover:text-ink active:scale-95"
        >
          <X aria-hidden className="size-3" strokeWidth={1.5} />
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
