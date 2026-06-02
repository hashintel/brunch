import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { renderMarkdownResult } from './shared/markdown.js';
import { STRUCTURED_EXCHANGE_REQUEST_SCHEMA, type StructuredExchangeRequestDetails } from './shared/model.js';

export const REQUEST_ANSWER_TOOL = 'request_answer' as const;

export const RequestAnswerParams = Type.Object({
  exchangeId: Type.String({
    description: 'The structured exchange id from the corresponding present_question entry.',
  }),
  respondsToPresentTool: Type.Optional(Type.Literal('present_question')),
  prompt: Type.String({
    description: 'Short live-input prompt. Do not repeat the presented question body.',
  }),
});

function responseMarkdown(details: StructuredExchangeRequestDetails): string {
  if (details.status === 'cancelled') return '### Response\n\n_User cancelled the request._';
  if (details.status === 'unavailable') {
    return `### Response\n\n_${details.message ?? 'Response UI unavailable.'}_`;
  }
  return ['### Response', '', details.answer ?? ''].join('\n');
}

export const requestAnswerTool = defineTool({
  name: REQUEST_ANSWER_TOOL,
  label: 'Request answer',
  description:
    'Collect a freeform user answer as the request half of a Brunch structured exchange. Use only after present_question.',
  promptSnippet: 'Request a freeform answer after presenting a question',
  promptGuidelines: [
    'Use request_answer only after the matching present_question tool.',
    'Do not repeat the present_question markdown content in request_answer parameters; reference it by exchangeId.',
  ],
  parameters: RequestAnswerParams,
  executionMode: 'sequential',

  async execute(toolCallId, params, _signal, _onUpdate, ctx) {
    const base = {
      schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
      schemaVersion: 1 as const,
      exchangeId: params.exchangeId,
      requestTool: REQUEST_ANSWER_TOOL,
      respondsTo: {
        exchangeId: params.exchangeId,
        presentTool: params.respondsToPresentTool ?? 'present_question',
      },
      createdAtToolCallId: toolCallId,
    };

    if (!ctx.hasUI || typeof ctx.ui.editor !== 'function') {
      const details: StructuredExchangeRequestDetails = {
        ...base,
        status: 'unavailable',
        message: 'request_answer requires interactive UI',
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    }

    const answer = await ctx.ui.editor(params.prompt);
    if (answer === undefined) {
      const details: StructuredExchangeRequestDetails = {
        ...base,
        status: 'cancelled',
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    }

    const details: StructuredExchangeRequestDetails = {
      ...base,
      status: 'answered',
      answer: answer.trim(),
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
