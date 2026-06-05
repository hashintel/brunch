import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { formatPresentQuestion } from '../../../structured-exchange/format/present-question.js';
import { projectPresentQuestion } from '../../../structured-exchange/project/present-question.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_QUESTION_TOOL = 'present_question' as const;

export const PresentQuestionParams = Type.Object({
  exchangeId: Type.String({
    description: 'Stable id tying this question to the later request_answer response.',
  }),
  heading: Type.String({ description: 'Question heading.' }),
  body: Type.Optional(
    Type.String({
      description: 'Markdown body for context before the answer request.',
    }),
  ),
  expectedRequestTool: Type.Optional(Type.Literal('request_answer')),
});

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
  parameters: PresentQuestionParams,
  executionMode: 'sequential',

  async execute(toolCallId, params) {
    const projection = projectPresentQuestion({
      toolCallId,
      exchangeId: params.exchangeId,
      heading: params.heading,
      body: params.body,
      expectedRequestTool: params.expectedRequestTool,
    });
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
