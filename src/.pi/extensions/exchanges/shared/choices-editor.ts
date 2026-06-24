import { projectRequestChoices } from '../../../../projections/exchanges/request-choices.js';
import { formatRequestChoices } from '../../../../renderers/exchanges/request-choices.js';
import { createMultiChoicePickerComponent } from '../../../components/multi-choice-picker.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_VERSION,
  zRequestChoicesEditorReply,
  type RequestChoicesEditorChoice,
  type RequestChoicesEditorEnvelopeInput,
  type RequestChoicesEditorResponse,
  type SelectedChoice,
} from '../schemas/index.js';
import { normalizeOptionalText } from './markdown.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

export interface StructuredExchangeChoice {
  readonly id: string;
  readonly label: string;
}

export function buildRequestChoicesEditorPrefill(params: {
  prompt: string;
  choices: readonly StructuredExchangeChoice[];
  allowOther?: boolean;
  allowNone?: boolean;
  commentPrompt?: string;
}): string {
  const choices = [
    ...params.choices,
    ...(params.allowOther ? [{ id: 'other', label: 'Other' }] : []),
    ...(params.allowNone ? [{ id: 'none', label: 'None' }] : []),
  ];
  const envelope = {
    schema: STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_SCHEMA,
    schemaVersion: STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_VERSION,
    prompt: params.prompt,
    mode: 'multi-choice',
    choices,
    instructions: [
      'Edit only response.',
      'Set response.status to answered or cancelled.',
      'For each selected choice, include its id in response.choices.',
      'Set response.comment to a string. Other or None requires a nonblank comment.',
    ],
    commentPrompt: params.commentPrompt ?? 'Optional comment',
    response: { status: 'cancelled', choices: [], comment: '' },
  } satisfies RequestChoicesEditorEnvelopeInput;
  return JSON.stringify(envelope, null, 2);
}

export function parseRequestChoicesEditorResponse(value: string): RequestChoicesEditorResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const reply = zRequestChoicesEditorReply.safeParse(parsed);
  return reply.success ? reply.data.response : null;
}

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
  readonly allowOther?: boolean;
  readonly allowNone?: boolean;
  readonly commentPrompt?: string;
}

function terminalResult(exchangeId: string, status: 'cancelled' | 'unavailable', message?: string) {
  const details = projectRequestChoices({ exchangeId, status, message });
  return { content: [{ type: 'text' as const, text: formatRequestChoices(details) }], details };
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
  if (matched.some((choice) => choice.kind === 'other' || choice.kind === 'none') && comment === undefined) {
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

    const needsComment =
      params.commentPrompt !== undefined ||
      picked.choices.some((choice) => choice.id === 'other' || choice.id === 'none');
    const comment = needsComment
      ? await ctx.ui.input?.(params.commentPrompt ?? 'Required comment')
      : undefined;
    return matchedChoicesResult(params, picked.choices, comment);
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
