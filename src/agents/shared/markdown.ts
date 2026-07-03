/**
 * Shared markdown block composition for Brunch LLM-facing text.
 *
 * Owns:
 * - filtering empty optional blocks
 * - trimming retained blocks
 * - joining retained blocks with a blank line
 * - no graph/session/exchange domain semantics
 *
 * Formatting primitives come directly from md-pen at call sites; this util is
 * house composition logic with no md-pen equivalent.
 */

export function joinMarkdownBlocks(...blocks: Array<string | null | undefined | false>): string {
  return blocks
    .filter((block): block is string => typeof block === 'string')
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join('\n\n');
}
