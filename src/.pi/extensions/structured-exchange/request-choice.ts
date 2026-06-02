import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { normalizeOptionalText, renderMarkdownResult } from './shared/markdown.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
  type StructuredExchangeChoice,
  type StructuredExchangeRequestDetails,
} from './shared/model.js';

export const REQUEST_CHOICE_TOOL = 'request_choice' as const;

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

function responseMarkdown(details: StructuredExchangeRequestDetails): string {
  if (details.status === 'cancelled') return '### Response\n\n_User cancelled the request._';
  if (details.status === 'unavailable') {
    return `### Response\n\n_${details.message ?? 'Response UI unavailable.'}_`;
  }
  const lines = ['### Response'];
  if (details.choice) lines.push('', `Selected: **${details.choice.label}**`);
  if (details.comment) lines.push('', 'Comment:', '', `> ${details.comment}`);
  return lines.join('\n');
}

function choiceByLabel(
  choices: readonly StructuredExchangeChoice[],
  selected: string,
): StructuredExchangeChoice | undefined {
  return choices.find((choice) => choice.label === selected || choice.id === selected);
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

  async execute(toolCallId, params, _signal, _onUpdate, ctx) {
    const choices: StructuredExchangeChoice[] = params.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
    }));
    const unavailable = (message: string) => {
      const details: StructuredExchangeRequestDetails = {
        schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
        schemaVersion: 1,
        exchangeId: params.exchangeId,
        requestTool: REQUEST_CHOICE_TOOL,
        status: 'unavailable',
        respondsTo: {
          exchangeId: params.exchangeId,
          presentTool: params.respondsToPresentTool,
        },
        message,
        createdAtToolCallId: toolCallId,
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
      const details: StructuredExchangeRequestDetails = {
        schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
        schemaVersion: 1,
        exchangeId: params.exchangeId,
        requestTool: REQUEST_CHOICE_TOOL,
        status: 'cancelled',
        respondsTo: {
          exchangeId: params.exchangeId,
          presentTool: params.respondsToPresentTool,
        },
        createdAtToolCallId: toolCallId,
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    }

    const picked = choiceByLabel(choices, selected);
    let choice = picked;
    let comment = '';
    if (!choice) {
      const other =
        typeof ctx.ui.input === 'function' ? await ctx.ui.input('Other', 'Describe your answer') : undefined;
      if (other === undefined || other.trim().length === 0) {
        const details: StructuredExchangeRequestDetails = {
          schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
          schemaVersion: 1,
          exchangeId: params.exchangeId,
          requestTool: REQUEST_CHOICE_TOOL,
          status: 'cancelled',
          respondsTo: {
            exchangeId: params.exchangeId,
            presentTool: params.respondsToPresentTool,
          },
          createdAtToolCallId: toolCallId,
        };
        return {
          content: [{ type: 'text' as const, text: responseMarkdown(details) }],
          details,
        };
      }
      choice = { id: 'other', label: other.trim() };
    } else if (typeof ctx.ui.input === 'function') {
      comment = (await ctx.ui.input(params.commentPrompt ?? 'Optional comment')) ?? '';
    }

    const details: StructuredExchangeRequestDetails = {
      schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
      schemaVersion: 1,
      exchangeId: params.exchangeId,
      requestTool: REQUEST_CHOICE_TOOL,
      status: 'answered',
      respondsTo: {
        exchangeId: params.exchangeId,
        presentTool: params.respondsToPresentTool,
      },
      choice,
      createdAtToolCallId: toolCallId,
    };
    const normalizedComment = normalizeOptionalText(comment);
    if (normalizedComment !== undefined) details.comment = normalizedComment;
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
