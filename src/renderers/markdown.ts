/**
 * Shared markdown formatting substrate for Brunch LLM-facing text.
 *
 * Owns:
 * - thin wrapper helpers around md-pen
 * - shared fenced-block and escaping conventions
 * - no graph/session/exchange domain semantics
 *
 * Future callers:
 * - renderers/graph/*
 * - renderers/session/*
 * - renderers/exchanges/*
 */

export function markdownHeading(level: number, text: string): string {
  return `${'#'.repeat(level)} ${text.trim()}`;
}

export function markdownBullet(text: string): string {
  return `- ${text}`;
}

export function markdownQuote(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

export function joinMarkdownBlocks(...blocks: Array<string | null | undefined | false>): string {
  return blocks
    .filter((block): block is string => typeof block === 'string')
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join('\n\n');
}
