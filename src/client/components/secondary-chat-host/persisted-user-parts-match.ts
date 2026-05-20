// Matches `formatMentionedItemsContextBlock` in server/intent-item-resolver.ts.
const MENTION_CONTEXT_BLOCK_PREFIX = 'Mentioned items (from `#` references in the user message):';

const MENTION_CONTEXT_SEPARATOR = `\n\n${MENTION_CONTEXT_BLOCK_PREFIX}`;

/** Bundle `user_parts` already includes composer text (possibly plus mention block). */
export function persistedUserPartsShowsComposerText(
  composerText: string,
  persistedUserParts: string,
): boolean {
  if (!persistedUserParts) return false;
  if (composerText === persistedUserParts) return true;
  if (!persistedUserParts.startsWith(composerText)) return false;
  return persistedUserParts.slice(composerText.length).startsWith(MENTION_CONTEXT_SEPARATOR);
}
