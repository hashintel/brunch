import { normalizeOptionalUnknownText } from '../../../../exchanges/text.js';
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

export type StepResult<T> =
  | { readonly status: 'answered'; readonly value: T }
  | { readonly status: 'back' }
  | { readonly status: 'unavailable'; readonly message: string };

export function back<T>(): StepResult<T> {
  return { status: 'back' };
}

export function unavailable<T>(message: string): StepResult<T> {
  return { status: 'unavailable', message };
}

export function isBack<T>(
  result: StepResult<T>,
): result is Extract<StepResult<T>, { readonly status: 'back' }> {
  return result.status === 'back';
}

export async function collectCommentStep(input: {
  readonly requirement: 'required' | 'optional';
  readonly prompt: string;
  readonly ctx: StructuredExchangeUiContext;
  readonly unavailableMessage: string;
}): Promise<StepResult<{ readonly comment?: string }>> {
  if (input.requirement === 'required') {
    const required = await collectRequiredInput(input.ctx, input.prompt);
    if (required.status === 'back') return back();
    if (required.status === 'unavailable') return unavailable(input.unavailableMessage);
    return { status: 'answered', value: { comment: required.value } };
  }
  if (typeof input.ctx.ui?.input !== 'function') return { status: 'answered', value: {} };
  const value = await input.ctx.ui.input(input.prompt);
  if (value === undefined) return back();
  const comment = normalizeOptionalUnknownText(value);
  return { status: 'answered', value: comment ? { comment } : {} };
}
