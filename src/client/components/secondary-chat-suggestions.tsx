import { cn } from '@/client/lib/utils';

import type { SecondaryChatMode } from './secondary-chat-trigger.js';

type ReconciliationKind = 'supersedes' | 'needs_confirmation';

/**
 * Static turn-zero suggestions keyed by (mode, optional reconciliation kind).
 * FE-716 C23: surfaces a row of 3 prompts when the secondary chat has only
 * its kickoff turn and no user-authored turn yet. Per UNIFIED_CHAT_UX.md §2
 * the suggestions replace the empty composer to give the user a starting
 * point. LLM-generated suggestions stay deferred to a follow-up frontier.
 *
 * The lists are intentionally short and editable in-line — once a real
 * second caller appears the lookup can move into its own module.
 */
const ASK_SUGGESTIONS = [
  'What does this item mean?',
  'How does this affect adjacent items?',
  'Suggest an alternative framing.',
] as const;

const EDIT_SUGGESTIONS = ['Tighten the wording.', 'Add a missing detail.', 'Split into two items.'] as const;

const ASK_RECONCILIATION_SUPERSEDES = [
  'Why does the new item supersede the existing one?',
  'What is preserved from the existing item?',
  'Show me what changes if I accept.',
] as const;

const ASK_RECONCILIATION_NEEDS_CONFIRMATION = [
  'What needs to be confirmed?',
  'Why is this flagged for confirmation?',
  'Suggest a confirmation criterion.',
] as const;

const EDIT_RECONCILIATION_SUPERSEDES = [
  'Apply the supersede now.',
  'Merge both items into one.',
  'Reject the supersede and explain why.',
] as const;

const EDIT_RECONCILIATION_NEEDS_CONFIRMATION = [
  'Confirm and close this need.',
  'Reword the existing item to remove ambiguity.',
  'Dismiss with a justification.',
] as const;

export function getSecondaryChatSuggestions(
  mode: SecondaryChatMode,
  reconciliationKind: ReconciliationKind | null,
): readonly string[] {
  if (reconciliationKind === 'supersedes') {
    return mode === 'edit' ? EDIT_RECONCILIATION_SUPERSEDES : ASK_RECONCILIATION_SUPERSEDES;
  }
  if (reconciliationKind === 'needs_confirmation') {
    return mode === 'edit' ? EDIT_RECONCILIATION_NEEDS_CONFIRMATION : ASK_RECONCILIATION_NEEDS_CONFIRMATION;
  }
  return mode === 'edit' ? EDIT_SUGGESTIONS : ASK_SUGGESTIONS;
}

export interface SecondaryChatSuggestionsProps {
  mode: SecondaryChatMode;
  reconciliationKind: ReconciliationKind | null;
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export function SecondaryChatSuggestions({
  mode,
  reconciliationKind,
  onPick,
  disabled,
}: SecondaryChatSuggestionsProps) {
  const suggestions = getSecondaryChatSuggestions(mode, reconciliationKind);
  return (
    <div
      data-testid="secondary-chat-suggestions"
      data-mode={mode}
      data-reconciliation-kind={reconciliationKind ?? 'none'}
      className="flex flex-wrap gap-1.5"
    >
      {suggestions.map((prompt) => (
        <button
          key={prompt}
          type="button"
          data-testid="secondary-chat-suggestion"
          disabled={disabled}
          onClick={() => onPick(prompt)}
          className={cn(
            'rounded-full border border-rule bg-background px-2 py-0.5 text-xs text-ink',
            'hover:bg-tint disabled:opacity-50',
          )}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
