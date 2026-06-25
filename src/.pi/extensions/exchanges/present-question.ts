import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatPresentQuestion } from '../../../agents/contexts/exchanges/present-question.js';
import { projectPresentQuestion } from '../../../projections/exchanges/present-question.js';
import { piSchema } from './pi-schema.js';
import { zPresentQuestionParams, type PresentQuestionParams } from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_QUESTION_TOOL = 'present_question' as const;

export const presentQuestionTool = defineTool({
  name: PRESENT_QUESTION_TOOL,
  label: 'Present question',
  description:
    'Persist and display a structured Brunch question. Omit options for free-text; include options for choice; set multiple for multi-choice. Call request_response after this result is available.',
  promptSnippet: 'Present a structured question before requesting a response',
  promptGuidelines: [
    'Use present_question for both free-text and option-based prompts; options[] presence determines the response kind.',
    'Call request_response after present_question. Do not call request_answer, request_choice, or request_choices.',
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
