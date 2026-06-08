import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectRequestChoice } from '../../../projections/exchanges/request-choice.js';
import { formatRequestChoice } from '../../../renderers/exchanges/request-choice.js';
import { piSchema } from './pi-schema.js';
import {
  zRequestChoiceParams,
  type RequestChoiceParam,
  type RequestChoiceParams,
  type SelectedChoice,
} from './schemas/index.js';
import { normalizeOptionalText, renderMarkdownResult } from './shared/markdown.js';

export const REQUEST_CHOICE_TOOL = 'request_choice' as const;

type StructuredExchangeChoice = RequestChoiceParam;

function choiceByLabel(
  choices: readonly StructuredExchangeChoice[],
  selected: string,
): StructuredExchangeChoice | undefined {
  return choices.find((choice) => choice.label === selected || choice.id === selected);
}

function selectedChoice(choice: StructuredExchangeChoice, kind: SelectedChoice['kind']): SelectedChoice {
  return { id: choice.id, label: choice.label, kind };
}

export const requestChoiceTool = defineTool({
  name: REQUEST_CHOICE_TOOL,
  label: 'Request choice',
  description:
    'Collect one user choice as the request half of a Brunch structured exchange. Use only after the corresponding present_* tool result has displayed the offer content.',
  promptSnippet: 'Request one choice after presenting a structured offer',
  promptGuidelines: [
    'Use request_choice only after the matching present_options or present_candidates tool.',
    'Do not repeat the present_* markdown content in request_choice parameters; reference it by exchangeId.',
  ],
  parameters: piSchema(zRequestChoiceParams),
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
    const params = zRequestChoiceParams.parse(rawParams) satisfies RequestChoiceParams;
    const choices = params.choices.map((choice) => ({ id: choice.id, label: choice.label }));
    const terminal = (status: 'cancelled' | 'unavailable', message?: string) => {
      const details = projectRequestChoice({
        exchangeId: params.exchangeId,
        respondsToPresentTool: params.respondsToPresentTool,
        status,
        message,
      });
      return { content: [{ type: 'text' as const, text: formatRequestChoice(details) }], details };
    };

    if (!ctx.hasUI || typeof ctx.ui.select !== 'function') {
      return terminal('unavailable', 'request_choice requires interactive UI');
    }

    const labels = [...choices.map((choice) => choice.label), ...(params.allowOther ? ['Other'] : [])];
    const selected = await ctx.ui.select(params.prompt, labels);
    if (selected === undefined) return terminal('cancelled');

    const picked = choiceByLabel(choices, selected);
    let choice: SelectedChoice;
    let comment = '';
    if (!picked) {
      const other =
        typeof ctx.ui.input === 'function' ? await ctx.ui.input('Other', 'Describe your answer') : undefined;
      if (other === undefined || other.trim().length === 0) return terminal('cancelled');
      choice = { id: 'other', label: other.trim(), kind: 'other' };
      comment = other.trim();
    } else {
      choice = selectedChoice(picked, 'listed');
      if (typeof ctx.ui.input === 'function') {
        comment = (await ctx.ui.input(params.commentPrompt ?? 'Optional comment')) ?? '';
      }
    }

    const details = projectRequestChoice({
      exchangeId: params.exchangeId,
      respondsToPresentTool: params.respondsToPresentTool,
      status: 'answered',
      choice,
      comment: normalizeOptionalText(comment),
    });
    return { content: [{ type: 'text' as const, text: formatRequestChoice(details) }], details };
  },

  renderCall() {
    return renderMarkdownResult({ content: [] });
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
