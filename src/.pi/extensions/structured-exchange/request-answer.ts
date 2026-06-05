import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import type { RequestAnswerDetails } from './schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA } from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

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

function responseMarkdown(details: RequestAnswerDetails): string {
  if ('cancelled' in details) return '### Response\n\n_User cancelled the request._';
  if ('unavailable' in details) return `### Response\n\n_${details.unavailable.message}_`;
  return ['### Response', '', details.answered.text].join('\n');
}

function base(exchangeId: string) {
  return {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: exchangeId,
    tool_meta: {
      prev: 'present_question' as const,
      curr: REQUEST_ANSWER_TOOL,
    },
  };
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

  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    if (!ctx.hasUI || typeof ctx.ui.editor !== 'function') {
      const details: RequestAnswerDetails = {
        ...base(params.exchangeId),
        unavailable: { message: 'request_answer requires interactive UI' },
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    }

    const answer = await ctx.ui.editor(params.prompt);
    if (answer === undefined) {
      const details: RequestAnswerDetails = {
        ...base(params.exchangeId),
        cancelled: {},
      };
      return {
        content: [{ type: 'text' as const, text: responseMarkdown(details) }],
        details,
      };
    }

    const details: RequestAnswerDetails = {
      ...base(params.exchangeId),
      tool_meta: { ...base(params.exchangeId).tool_meta, next: 'capture_answer' },
      answered: { text: answer.trim() },
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
