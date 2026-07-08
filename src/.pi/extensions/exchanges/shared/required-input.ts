import type { StructuredExchangeUiContext } from './ui-context.js';

/**
 * Collect a value the response schema requires — a required comment or the
 * Other write-in text. An empty submit re-prompts: a required field must
 * never submit empty and terminate the exchange as an error (or silently
 * cancel it). Dismissing an available input resolves as back so nested ask
 * steps can return to their picker; a missing input capability resolves as
 * unavailable so the caller can leave the turn reactive and let the model reroute.
 */
export type RequiredInputResult =
  | { readonly status: 'answered'; readonly value: string }
  | { readonly status: 'back' }
  | { readonly status: 'unavailable' };

export async function collectRequiredInput(
  ctx: StructuredExchangeUiContext,
  prompt: string,
  placeholder?: string,
): Promise<RequiredInputResult> {
  if (typeof ctx.ui?.input !== 'function') return { status: 'unavailable' };
  let attemptPrompt = prompt;
  for (;;) {
    const value = await ctx.ui.input(attemptPrompt, placeholder);
    if (value === undefined) return { status: 'back' };
    if (value.trim().length > 0) return { status: 'answered', value: value.trim() };
    attemptPrompt = `${prompt} (required — cannot be empty)`;
  }
}
