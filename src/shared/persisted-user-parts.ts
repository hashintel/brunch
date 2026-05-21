/** First line of the server-appended `#` mention snapshot — keep in sync with `formatMentionedItemsContextBlock`. */
export const MENTION_CONTEXT_BLOCK_PREFIX = 'Mentioned items (from `#` references in the user message):';

export const MENTION_CONTEXT_SEPARATOR = `\n\n${MENTION_CONTEXT_BLOCK_PREFIX}`;

/** User-visible composer text from persisted `turn.user_parts`. */
export function composerTextFromPersistedUserParts(persistedUserParts: string): string {
  const idx = persistedUserParts.indexOf(MENTION_CONTEXT_SEPARATOR);
  if (idx === -1) return persistedUserParts;
  return persistedUserParts.slice(0, idx);
}

/** True when bundle `user_parts` already includes the in-flight composer message. */
export function persistedUserPartsShowsComposerText(
  composerText: string,
  persistedUserParts: string,
): boolean {
  if (!persistedUserParts) return false;
  return composerText === composerTextFromPersistedUserParts(persistedUserParts);
}
