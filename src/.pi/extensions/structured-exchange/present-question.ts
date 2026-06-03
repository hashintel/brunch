import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { renderMarkdownResult } from './shared/markdown.js';
import { STRUCTURED_EXCHANGE_PRESENT_SCHEMA, type StructuredExchangePresentDetails } from './shared/model.js';

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
    const body = params.body?.trim();
    const markdown = [`## ${params.heading.trim()}`, body ? `\n${body}` : undefined]
      .filter(Boolean)
      .join('\n');
    const details: StructuredExchangePresentDetails = {
      schema: STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
      schemaVersion: 1,
      exchangeId: params.exchangeId,
      presentTool: PRESENT_QUESTION_TOOL,
      kind: 'question',
      status: 'presented',
      expectedRequest: {
        tool: params.expectedRequestTool ?? 'request_answer',
        required: true,
      },
      createdAtToolCallId: toolCallId,
    };
    return { content: [{ type: 'text' as const, text: markdown }], details };
  },

  renderCall() {
    return renderMarkdownResult({ content: [] });
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
