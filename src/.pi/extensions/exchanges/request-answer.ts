import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectRequestAnswer } from '../../../projections/exchanges/request-answer.js';
import { formatRequestAnswer } from '../../../renderers/exchanges/request-answer.js';
import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { piSchema } from './pi-schema.js';
import { zRequestAnswerParams, type RequestAnswerParams } from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const REQUEST_ANSWER_TOOL = 'request_answer' as const;

export function createRequestAnswerTool(answerBroker?: LiveExchangeAwaiter) {
  return defineTool({
    name: REQUEST_ANSWER_TOOL,
    label: 'Request answer',
    description:
      'Collect a freeform user answer as the request half of a Brunch structured exchange. Use only after present_question.',
    promptSnippet: 'Request a freeform answer after presenting a question',
    promptGuidelines: [
      'Use request_answer only after the matching present_question tool.',
      'Do not repeat the present_question markdown content in request_answer parameters; reference it by exchangeId.',
    ],
    parameters: piSchema(zRequestAnswerParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = zRequestAnswerParams.parse(rawParams) satisfies RequestAnswerParams;
      let answer: string | undefined;
      if (ctx.hasUI && typeof ctx.ui.editor === 'function') {
        answer = await ctx.ui.editor(params.prompt);
      } else if (answerBroker) {
        answer = await answerBroker.awaitAnswer({ exchangeId: params.exchangeId });
      } else {
        const details = projectRequestAnswer({
          exchangeId: params.exchangeId,
          status: 'unavailable',
          message: 'request_answer requires interactive UI',
        });
        return { content: [{ type: 'text' as const, text: formatRequestAnswer(details) }], details };
      }

      const details =
        answer === undefined
          ? projectRequestAnswer({ exchangeId: params.exchangeId, status: 'cancelled' })
          : projectRequestAnswer({ exchangeId: params.exchangeId, status: 'answered', answer });
      return { content: [{ type: 'text' as const, text: formatRequestAnswer(details) }], details };
    },

    renderCall() {
      return renderMarkdownResult({ content: [] });
    },

    renderResult(result, _options, theme) {
      return renderMarkdownResult(result, theme);
    },
  });
}

export const requestAnswerTool = createRequestAnswerTool();
