import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import type { RequestChoiceDetails, SelectedChoice } from './schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA } from './schemas/index.js';
import { normalizeOptionalText, renderMarkdownResult } from './shared/markdown.js';

export const REQUEST_CHOICE_TOOL = 'request_choice' as const;

type RequestChoicePresentTool = 'present_options' | 'present_candidates';

interface StructuredExchangeChoice {
  readonly id: string;
  readonly label: string;
}

const ChoiceSchema = Type.Object({
  id: Type.String({
    description: 'Stable choice id from the corresponding present_* entry.',
  }),
  label: Type.String({
    description: 'Short choice label shown in the live selection UI.',
  }),
});

export const RequestChoiceParams = Type.Object({
  exchangeId: Type.String({
    description: 'The structured exchange id from the corresponding present_* entry.',
  }),
  respondsToPresentTool: Type.Union([Type.Literal('present_options'), Type.Literal('present_candidates')]),
  prompt: Type.String({
    description: 'Short live-input prompt. Do not repeat the presented content.',
  }),
  choices: Type.Array(ChoiceSchema, {
    description: 'Choices available for this response.',
  }),
  allowOther: Type.Optional(Type.Boolean({ description: 'Whether the user may choose Other.' })),
  commentPrompt: Type.Optional(
    Type.String({
      description: 'Prompt for optional comment after a listed choice.',
    }),
  ),
});

function responseMarkdown(details: RequestChoiceDetails): string {
  if ('cancelled' in details) return '### Response\n\n_User cancelled the request._';
  if ('unavailable' in details) return `### Response\n\n_${details.unavailable.message}_`;
  const lines = ['### Response', '', `Selected: **${details.answered.choice.label}**`];
  if (details.answered.comment) lines.push('', 'Comment:', '', `> ${details.answered.comment}`);
  return lines.join('\n');
}

function choiceByLabel(
  choices: readonly StructuredExchangeChoice[],
  selected: string,
): StructuredExchangeChoice | undefined {
  return choices.find((choice) => choice.label === selected || choice.id === selected);
}

function selectedChoice(choice: StructuredExchangeChoice, kind: SelectedChoice['kind']): SelectedChoice {
  return { id: choice.id, label: choice.label, kind };
}

function base(exchangeId: string, prev: RequestChoicePresentTool) {
  return {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: exchangeId,
    tool_meta: {
      prev,
      curr: REQUEST_CHOICE_TOOL,
    },
  };
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
  parameters: RequestChoiceParams,
  executionMode: 'sequential',

  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const choices: StructuredExchangeChoice[] = params.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
    }));
    const unavailable = (message: string) => {
      const details: RequestChoiceDetails = {
        ...base(params.exchangeId, params.respondsToPresentTool),
        unavailable: { message },
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    };

    if (!ctx.hasUI || typeof ctx.ui.select !== 'function') {
      return unavailable('request_choice requires interactive UI');
    }

    const labels = [...choices.map((choice) => choice.label), ...(params.allowOther ? ['Other'] : [])];
    const selected = await ctx.ui.select(params.prompt, labels);
    if (selected === undefined) {
      const details: RequestChoiceDetails = {
        ...base(params.exchangeId, params.respondsToPresentTool),
        cancelled: {},
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    }

    const picked = choiceByLabel(choices, selected);
    let choice: SelectedChoice;
    let comment = '';
    if (!picked) {
      const other =
        typeof ctx.ui.input === 'function' ? await ctx.ui.input('Other', 'Describe your answer') : undefined;
      if (other === undefined || other.trim().length === 0) {
        const details: RequestChoiceDetails = {
          ...base(params.exchangeId, params.respondsToPresentTool),
          cancelled: {},
        };
        return {
          content: [{ type: 'text' as const, text: responseMarkdown(details) }],
          details,
        };
      }
      choice = { id: 'other', label: other.trim(), kind: 'other' };
      comment = other.trim();
    } else {
      choice = selectedChoice(picked, 'listed');
      if (typeof ctx.ui.input === 'function') {
        comment = (await ctx.ui.input(params.commentPrompt ?? 'Optional comment')) ?? '';
      }
    }

    const normalizedComment = normalizeOptionalText(comment);
    const baseDetails = base(params.exchangeId, params.respondsToPresentTool);
    const details: RequestChoiceDetails = {
      ...baseDetails,
      tool_meta: baseDetails.tool_meta,
      answered: {
        choice,
        ...(normalizedComment !== undefined ? { comment: normalizedComment } : {}),
      },
    };
    return {
      content: [{ type: 'text' as const, text: responseMarkdown(details) }],
      details,
    };
  },

  renderCall() {
    return renderMarkdownResult({ content: [] });
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
