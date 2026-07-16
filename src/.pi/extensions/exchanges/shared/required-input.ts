import type { ReviewDecision } from '../../../../exchanges/projections/request-response.js';
import {
  structuredExchangeResponseRequiresComment,
  type ChoiceKind,
} from '../../../../exchanges/schemas/index.js';
import { normalizeOptionalUnknownText } from '../../../../exchanges/text.js';
import { projectBrunchAgentState } from '../../../../projections/session/runtime-state.js';
import { operationalModeBorderColor } from '../../../components/mode-border-theme.js';
import { ModeInputComponent } from '../../../components/mode-input.js';
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
  const custom = ctx.ui?.custom;
  if (typeof custom === 'function') {
    const value = await custom<string | undefined>((tui, theme, _keybindings, done) => {
      const borderColor = operationalModeBorderColor(
        theme,
        projectBrunchAgentState(ctx.sessionManager?.getBranch() ?? []).operationalMode,
      );
      return new ModeInputComponent({ prompt, theme, borderColor, onDone: done });
    });
    return value === undefined ? { status: 'back' } : { status: 'answered', value: value.trim() };
  }
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
type CommentRequirementInput =
  | {
      readonly choiceKinds: readonly ChoiceKind[];
      readonly reviewDecision?: never;
    }
  | {
      readonly choiceKinds?: never;
      readonly reviewDecision: ReviewDecision;
    };

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
  if (typeof input.ctx.ui?.custom === 'function') {
    const value = await input.ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
      const borderColor = operationalModeBorderColor(
        theme,
        projectBrunchAgentState(input.ctx.sessionManager?.getBranch() ?? []).operationalMode,
      );
      return new ModeInputComponent({
        prompt: input.prompt,
        theme,
        borderColor,
        allowEmpty: true,
        onDone: done,
      });
    });
    if (value === undefined) return back();
    const comment = normalizeOptionalUnknownText(value);
    return { status: 'answered', value: comment ? { comment } : {} };
  }
  if (typeof input.ctx.ui?.input !== 'function') return { status: 'answered', value: {} };
  const value = await input.ctx.ui.input(input.prompt);
  if (value === undefined) return back();
  const comment = normalizeOptionalUnknownText(value);
  return { status: 'answered', value: comment ? { comment } : {} };
}

export async function collectCommentRequirementStep(
  input: CommentRequirementInput & {
    readonly ctx: StructuredExchangeUiContext;
    readonly requiredPrompt: string;
    readonly optionalPrompt?: string | undefined;
    readonly unavailableMessage: string;
  },
): Promise<StepResult<{ readonly comment?: string }>> {
  const requirement = structuredExchangeResponseRequiresComment(
    input.reviewDecision !== undefined
      ? { reviewDecision: input.reviewDecision }
      : { choiceKinds: input.choiceKinds },
  )
    ? 'required'
    : 'optional';
  if (requirement === 'optional') {
    if (input.optionalPrompt === undefined) return { status: 'answered', value: {} };
    return collectCommentStep({
      requirement,
      prompt: input.optionalPrompt,
      ctx: input.ctx,
      unavailableMessage: input.unavailableMessage,
    });
  }
  return collectCommentStep({
    requirement,
    prompt: input.requiredPrompt,
    ctx: input.ctx,
    unavailableMessage: input.unavailableMessage,
  });
}
