import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectRequestChoices } from '../../../projections/structured-exchange/request-choices.js';
import { formatRequestChoices } from '../../../renderers/structured-exchange/request-choices.js';
import { piSchema } from './pi-schema.js';
import {
  zRequestChoicesParams,
  type RequestChoiceParam,
  type RequestChoicesParams,
  type SelectedChoice,
} from './schemas/index.js';
import { normalizeOptionalText, renderMarkdownResult } from './shared/markdown.js';

export const REQUEST_CHOICES_TOOL = 'request_choices' as const;

type StructuredExchangeChoice = RequestChoiceParam;

interface EditorChoice {
  id: string;
  label?: string;
}

interface EditorResponse {
  status: 'answered' | 'cancelled';
  choices: EditorChoice[];
  comment: string;
}

function buildEditorPrefill(params: {
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
  return JSON.stringify(
    {
      schema: 'brunch.structured_exchange.request_choices.editor',
      schemaVersion: 1,
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
    },
    null,
    2,
  );
}

function parseEditorResponse(value: string): EditorResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const response = parsed.response;
  if (!isRecord(response)) return null;

  if (response.status === 'cancelled') return { status: 'cancelled', choices: [], comment: '' };
  if (response.status !== 'answered') return null;
  if (!Array.isArray(response.choices)) return null;
  if (typeof response.comment !== 'string') return null;

  const choices = response.choices.map((choice): EditorChoice | null => {
    if (!isRecord(choice) || typeof choice.id !== 'string') return null;
    return {
      id: choice.id,
      ...(typeof choice.label === 'string' ? { label: choice.label } : {}),
    };
  });
  if (choices.some((choice) => choice === null)) return null;
  return { status: 'answered', choices: choices as EditorChoice[], comment: response.comment };
}

function matchSelectedChoices(
  selected: readonly EditorChoice[],
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

export const requestChoicesTool = defineTool({
  name: REQUEST_CHOICES_TOOL,
  label: 'Request choices',
  description:
    'Collect one-or-more user choices as the request half of a Brunch structured exchange. Use only after the corresponding present_options tool result has displayed the offer content.',
  promptSnippet: 'Request multiple choices after presenting structured options',
  promptGuidelines: [
    'Use request_choices only after the matching present_options tool.',
    'Do not repeat the present_options markdown content in request_choices parameters; reference it by exchangeId.',
    'Require a comment when the response selects Other or None.',
  ],
  parameters: piSchema(zRequestChoicesParams),
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
    const params = zRequestChoicesParams.parse(rawParams) satisfies RequestChoicesParams;
    const choices = params.choices.map((choice) => ({ id: choice.id, label: choice.label }));
    const terminal = (status: 'cancelled' | 'unavailable', message?: string) => {
      const details = projectRequestChoices({ exchangeId: params.exchangeId, status, message });
      return { content: [{ type: 'text' as const, text: formatRequestChoices(details) }], details };
    };

    if (!ctx.hasUI || typeof ctx.ui.editor !== 'function') {
      return terminal('unavailable', 'request_choices requires interactive UI');
    }

    const editorPrefillParams: Parameters<typeof buildEditorPrefill>[0] = { prompt: params.prompt, choices };
    if (params.allowOther !== undefined) editorPrefillParams.allowOther = params.allowOther;
    if (params.allowNone !== undefined) editorPrefillParams.allowNone = params.allowNone;
    if (params.commentPrompt !== undefined) editorPrefillParams.commentPrompt = params.commentPrompt;

    const edited = await ctx.ui.editor(buildEditorPrefill(editorPrefillParams));
    if (edited === undefined) return terminal('cancelled');

    const response = parseEditorResponse(edited);
    if (!response) return terminal('unavailable', 'request_choices editor fallback returned invalid JSON');
    if (response.status === 'cancelled') return terminal('cancelled');

    const matchParams: Parameters<typeof matchSelectedChoices>[1] = { choices };
    if (params.allowOther !== undefined) matchParams.allowOther = params.allowOther;
    if (params.allowNone !== undefined) matchParams.allowNone = params.allowNone;

    const matched = matchSelectedChoices(response.choices, matchParams);
    if (typeof matched === 'string') return terminal('unavailable', matched);

    const comment = normalizeOptionalText(response.comment);
    if (
      matched.some((choice) => choice.kind === 'other' || choice.kind === 'none') &&
      comment === undefined
    ) {
      return terminal('unavailable', 'request_choices requires a comment for Other or None selections');
    }

    const details = projectRequestChoices({
      exchangeId: params.exchangeId,
      status: 'answered',
      choices: matched,
      comment,
    });
    return { content: [{ type: 'text' as const, text: formatRequestChoices(details) }], details };
  },

  renderCall() {
    return renderMarkdownResult({ content: [] });
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
