/**
 * XML-style section wrapper for LLM-facing context blocks.
 *
 * Owns the house newline convention only; callers own tag choice and body content.
 */

export function section(tag: string, body: string): string {
  const trimmedBody = body.trim();
  return `<${tag}>\n${trimmedBody}\n</${tag}>`;
}
