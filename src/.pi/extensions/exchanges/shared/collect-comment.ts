import type { StructuredExchangeUiContext } from './ui-context.js';

/**
 * Collect a comment the response schema requires. An empty submit re-prompts —
 * a required field must never submit empty and terminate the exchange as an
 * error. Dismissing the input (undefined) returns undefined so the caller can
 * resolve the exchange as cancelled, never as an unavailable error terminal.
 * The unavailable guard in the projection layer stays as the backstop for
 * non-interactive paths (editor envelope / RPC), which have no re-prompt loop.
 */
export async function collectRequiredComment(
  ctx: StructuredExchangeUiContext,
  prompt: string,
): Promise<string | undefined> {
  if (typeof ctx.ui?.input !== 'function') return undefined;
  let attemptPrompt = prompt;
  for (;;) {
    const comment = await ctx.ui.input(attemptPrompt);
    if (comment === undefined) return undefined;
    if (comment.trim().length > 0) return comment.trim();
    attemptPrompt = `${prompt} (required — cannot be empty)`;
  }
}
