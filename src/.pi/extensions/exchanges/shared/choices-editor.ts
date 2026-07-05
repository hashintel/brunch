import { formatRequestChoices } from '../../../../agents/contexts/exchanges/request-response.js';
import {
  buildRequestChoicesEditorPrefill,
  parseRequestChoicesEditorResponse,
  type RequestChoicesEditorChoice,
  type StructuredExchangeChoice,
} from '../../../../exchanges/editor-envelope.js';
import { projectRequestChoices } from '../../../../exchanges/projections/request-response.js';
import {
  structuredExchangeResponseRequiresComment,
  type AnsweredOptionEcho,
  type SelectedChoice,
} from '../../../../exchanges/schemas/index.js';
import { createMultiChoicePickerComponent } from '../../../components/multi-choice-picker.js';
import { collectRequiredComment } from './collect-comment.js';
import { normalizeOptionalText } from './markdown.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

function matchSelectedChoices(
  selected: readonly RequestChoicesEditorChoice[],
  params: {
    choices: readonly StructuredExchangeChoice[];
    allowOther?: boolean;
    allowNone?: boolean;
  },
): SelectedChoice[] | string {
  const allowed = new Map<string, SelectedChoice>(
    params.choices.map((choice) => [choice.id, { id: choice.id, label: choice.label, kind: 'listed' }]),
  );
  if (params.allowOther) allowed.set('other', { id: 'other', label: 'Other', kind: 'other' });
  if (params.allowNone) allowed.set('none', { id: 'none', label: 'None', kind: 'none' });

  const matched: SelectedChoice[] = [];
  const seen = new Set<string>();
  for (const choice of selected) {
    const known = allowed.get(choice.id);
    if (!known) return `request_choices received unknown choice id: ${choice.id}`;
    if (seen.has(choice.id)) continue;
    seen.add(choice.id);
    matched.push({ id: known.id, label: choice.label ?? known.label, kind: known.kind });
  }
  if (matched.length === 0) return 'request_choices requires at least one choice';
  return matched;
}

export interface RequestChoicesEditorFlowParams {
  readonly exchangeId: string;
  readonly prompt: string;
  readonly choices: readonly StructuredExchangeChoice[];
  readonly options: readonly AnsweredOptionEcho[];
  readonly allowOther?: boolean;
  readonly allowNone?: boolean;
  readonly commentPrompt?: string;
}

function terminalResult(exchangeId: string, status: 'cancelled' | 'unavailable', message?: string) {
  const details = projectRequestChoices({ exchangeId, status, message });
  return {
    content: [{ type: 'text' as const, text: formatRequestChoices(details) }],
    details,
    // A user cancel means "leave me inert": end the turn on this tool result.
    // Unavailable stays reactive so the model can reroute.
    ...(status === 'cancelled' ? { terminate: true } : {}),
  };
}

function choicesWithSpecialOptions(params: RequestChoicesEditorFlowParams): StructuredExchangeChoice[] {
  return [
    ...params.choices,
    ...(params.allowOther ? [{ id: 'other', label: 'Other' }] : []),
    ...(params.allowNone ? [{ id: 'none', label: 'None' }] : []),
  ];
}

function matchedChoicesResult(
  params: RequestChoicesEditorFlowParams,
  choices: readonly RequestChoicesEditorChoice[],
  commentText: string | undefined,
) {
  const matchParams: Parameters<typeof matchSelectedChoices>[1] = { choices: params.choices };
  if (params.allowOther !== undefined) matchParams.allowOther = params.allowOther;
  if (params.allowNone !== undefined) matchParams.allowNone = params.allowNone;

  const matched = matchSelectedChoices(choices, matchParams);
  if (typeof matched === 'string') return terminalResult(params.exchangeId, 'unavailable', matched);

  const comment = normalizeOptionalText(commentText);
  if (
    structuredExchangeResponseRequiresComment({ choiceKinds: matched.map((choice) => choice.kind) }) &&
    comment === undefined
  ) {
    return terminalResult(
      params.exchangeId,
      'unavailable',
      'request_choices requires a comment for Other or None selections',
    );
  }

  const details = projectRequestChoices({
    exchangeId: params.exchangeId,
    status: 'answered',
    choices: matched,
    options: params.options,
    comment,
  });
  return { content: [{ type: 'text' as const, text: formatRequestChoices(details) }], details };
}

export async function requestChoicesFromSources(
  params: RequestChoicesEditorFlowParams,
  ctx: StructuredExchangeUiContext,
) {
  if (ctx.hasUI && typeof ctx.ui?.custom === 'function') {
    const picked = await ctx.ui.custom<
      { readonly choices: readonly RequestChoicesEditorChoice[] } | undefined
    >((_tui, theme, _keybindings, done) =>
      createMultiChoicePickerComponent({
        prompt: params.prompt,
        choices: choicesWithSpecialOptions(params),
        theme,
        onDone: done,
      }),
    );
    if (picked === undefined) return terminalResult(params.exchangeId, 'cancelled');

    let choices: readonly RequestChoicesEditorChoice[] = picked.choices;
    if (choices.some((choice) => choice.id === 'other')) {
      const other =
        typeof ctx.ui.input === 'function' ? await ctx.ui.input('Other', 'Describe your answer') : undefined;
      if (other === undefined || other.trim().length === 0) {
        return terminalResult(params.exchangeId, 'cancelled');
      }
      choices = choices.map((choice) =>
        choice.id === 'other' ? { ...choice, label: other.trim() } : choice,
      );
    }

    const requiresComment = structuredExchangeResponseRequiresComment({
      choiceKinds: choices.map((choice) =>
        choice.id === 'none' ? 'none' : choice.id === 'other' ? 'other' : 'listed',
      ),
    });
    let comment: string | undefined;
    if (requiresComment) {
      comment = await collectRequiredComment(ctx, params.commentPrompt ?? 'Required comment');
      if (comment === undefined) return terminalResult(params.exchangeId, 'cancelled');
    } else if (params.commentPrompt !== undefined) {
      comment = await ctx.ui.input?.(params.commentPrompt);
    }
    return matchedChoicesResult(params, choices, comment);
  }

  if (ctx.hasUI && typeof ctx.ui?.editor === 'function') {
    return requestChoicesViaEditor(params, (prefill) => ctx.ui!.editor!(prefill));
  }

  return terminalResult(params.exchangeId, 'unavailable', 'request_response choices requires interactive UI');
}

/**
 * The full editor exchange for request_choices result details: schema-derived
 * prefill, edited JSON back, schema parse, choice matching, and projection into
 * canonical result details. request_response drives it through `ctx.ui.editor`;
 * the RPC proof probe drives it through a raw RPC editor relay.
 */
export async function requestChoicesViaEditor(
  params: RequestChoicesEditorFlowParams,
  openEditor: (prefill: string) => Promise<string | undefined>,
) {
  const prefillParams: Parameters<typeof buildRequestChoicesEditorPrefill>[0] = {
    prompt: params.prompt,
    choices: params.choices,
  };
  if (params.allowOther !== undefined) prefillParams.allowOther = params.allowOther;
  if (params.allowNone !== undefined) prefillParams.allowNone = params.allowNone;
  if (params.commentPrompt !== undefined) prefillParams.commentPrompt = params.commentPrompt;

  const edited = await openEditor(buildRequestChoicesEditorPrefill(prefillParams));
  if (edited === undefined) return terminalResult(params.exchangeId, 'cancelled');

  const response = parseRequestChoicesEditorResponse(edited);
  if (!response) {
    return terminalResult(
      params.exchangeId,
      'unavailable',
      'request_choices editor fallback returned invalid JSON',
    );
  }
  if (response.status === 'cancelled') return terminalResult(params.exchangeId, 'cancelled');

  return matchedChoicesResult(params, response.choices, response.comment);
}
