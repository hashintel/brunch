import type { StructuredExchangeUiContext } from './ui-context.js';

/**
 * Collect a value the response schema requires — a required comment or the
 * Other write-in text. An empty submit re-prompts: a required field must
 * never submit empty and terminate the exchange as an error (or silently
 * cancel it). Dismissing the input (undefined) returns undefined so the
 * caller can resolve the exchange as cancelled, never as an unavailable
 * error terminal. The unavailable guard in the projection layer stays as the
 * backstop for non-interactive paths (editor envelope / RPC), which have no
 * re-prompt loop.
 */
export async function collectRequiredInput(
  ctx: StructuredExchangeUiContext,
  prompt: string,
  placeholder?: string,
): Promise<string | undefined> {
  if (typeof ctx.ui?.input !== 'function') return undefined;
  let attemptPrompt = prompt;
  for (;;) {
    const value = await ctx.ui.input(attemptPrompt, placeholder);
    if (value === undefined) return undefined;
    if (value.trim().length > 0) return value.trim();
    attemptPrompt = `${prompt} (required — cannot be empty)`;
  }
}
