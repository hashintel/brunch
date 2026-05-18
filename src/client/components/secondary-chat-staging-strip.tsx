import { Check, Undo2, X } from 'lucide-react';

import { cn } from '@/client/lib/utils';

import { ContentDiff } from './content-diff.js';
import { ImpactChip } from './impact-chip.js';
import { usePatchListForChat } from './patch-list-host.js';

/**
 * Per-secondary-chat staged-patches strip.
 *
 * Subscribes to `usePatchListForChat(chatId)` (Shape A partition seam from
 * FE-716 C5c) so it sees only patches whose `producerChatId === chatId`.
 * Renders a compact list of staged patches with apply/undo/discard controls
 * and an inline `<ContentDiff>` for `edit` patches whose before/after pair is
 * available. Mounted inside `<SecondaryChatHost>`'s collapsible body.
 *
 * Intentionally minimal — the popover's full visual treatment (accent
 * tinting, hover affordances, "view diff" popover) is not harvested wholesale
 * for V1; the inline surface needs only the apply/undo loop. Forks can lift
 * `<ImpactChip>` / `<ContentDiff>` to a shared location if a third caller
 * appears.
 */
export interface SecondaryChatStagingStripProps {
  chatId: number;
}

export function SecondaryChatStagingStrip({ chatId }: SecondaryChatStagingStripProps) {
  const patchList = usePatchListForChat(chatId);
  if (!patchList || patchList.staged.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="secondary-chat-staging-strip"
      data-chat-id={chatId}
      data-staged-patch-count={patchList.staged.length}
      aria-label="Staged changes"
      className="flex flex-col gap-1.5 rounded-lg border border-rule bg-tint/30 p-2 text-xs"
    >
      <header className="flex items-center justify-between px-1 text-sub">
        <span>
          {patchList.staged.length} pending change{patchList.staged.length === 1 ? '' : 's'}
        </span>
      </header>
      <ul className="flex flex-col gap-1">
        {patchList.staged.map((patch) => (
          <li
            key={patch.id}
            data-staged-patch-id={patch.id}
            className="flex flex-col gap-1 rounded px-1.5 py-1 hover:bg-tint/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-hint uppercase">{patch.kind}</span>
              <span className="min-w-0 flex-1 truncate text-ink" title={patch.summary}>
                {patch.summary}
              </span>
              {patch.kind === 'edit' && patch.impact ? <ImpactChip impact={patch.impact} /> : null}
              <button
                type="button"
                aria-label={`Discard staged change: ${patch.summary}`}
                data-testid="secondary-chat-staging-discard"
                onClick={() => patchList.discard(patch.id)}
                className="inline-flex size-4 shrink-0 items-center justify-center rounded text-hint hover:bg-tint/60 hover:text-ink"
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
            {patch.kind === 'edit' &&
            typeof patch.currentContent === 'string' &&
            typeof patch.newContent === 'string' &&
            patch.currentContent !== patch.newContent ? (
              <div className="rounded bg-background p-1.5 text-[11px]">
                <ContentDiff before={patch.currentContent} after={patch.newContent} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2 pt-1">
        {patchList.isApplying ? (
          <span role="status" className="text-hint">
            Saving change…
          </span>
        ) : null}
        {patchList.canUndo ? (
          <button
            type="button"
            data-testid="secondary-chat-staging-undo"
            onClick={() => {
              void patchList.undo();
            }}
            aria-label="Undo last applied change"
            className="inline-flex size-6 items-center justify-center rounded border border-rule text-ink hover:bg-tint/60"
          >
            <Undo2 className="size-3.5" aria-hidden />
            <span className="sr-only">Undo</span>
          </button>
        ) : null}
        <button
          type="button"
          data-testid="secondary-chat-staging-apply"
          disabled={patchList.isApplying}
          onClick={() => {
            void patchList.apply();
          }}
          aria-label={`Apply ${patchList.staged.length} change${patchList.staged.length === 1 ? '' : 's'}`}
          className={cn(
            'inline-flex size-6 items-center justify-center rounded bg-foreground text-background hover:opacity-90',
            patchList.isApplying && 'opacity-50',
          )}
        >
          <Check className="size-3.5" aria-hidden strokeWidth={2.5} />
          <span className="sr-only">Apply</span>
        </button>
      </div>
    </section>
  );
}
