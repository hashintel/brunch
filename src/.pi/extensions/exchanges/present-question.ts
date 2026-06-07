import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectPresentQuestion } from '../../../projections/exchanges/present-question.js';
import { formatPresentQuestion } from '../../../renderers/structured-exchange/present-question.js';
import { piSchema } from './pi-schema.js';
import { zPresentQuestionParams, type PresentQuestionParams } from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_QUESTION_TOOL = 'present_question' as const;

export const presentQuestionTool = defineTool({
  name: PRESENT_QUESTION_TOOL,
  label: 'Present question',
  description:
    'Persist and display a structured question as the present half of a Brunch structured exchange. Call request_answer after this result is available.',
  promptSnippet: 'Present a structured question before requesting an answer',
  promptGuidelines: [
    'Use present_question before request_answer.',
    'The durable user-visible question is this tool result, not renderCall.',
  ],
  parameters: piSchema(zPresentQuestionParams),
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams) {
    const params = zPresentQuestionParams.parse(rawParams) satisfies PresentQuestionParams;
    const projection = projectPresentQuestion(params);
    return {
      content: [{ type: 'text' as const, text: formatPresentQuestion(projection) }],
      details: projection.details,
    };
  },

  renderCall() {
    return renderMarkdownResult({ content: [] });
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
