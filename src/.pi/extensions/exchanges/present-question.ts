import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatPresentQuestion } from '../../../agents/contexts/exchanges/present-question.js';
import { projectPresentQuestion } from '../../../exchanges/projections/present-question.js';
import { zPresentQuestionParams, type PresentQuestionParams } from '../../../exchanges/schemas/index.js';
import { piSchema } from './pi-schema.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_QUESTION_TOOL = 'present_question' as const;

export const presentQuestionTool = defineTool({
  name: PRESENT_QUESTION_TOOL,
  label: 'Present question',
  description:
    'Persist and display a structured Brunch question. Omit options for a free-text answer; include options for a finite choice; set multiple only when the user may pick more than one option. Call request_response after this result is available.',
  promptSnippet: 'Present a structured question before requesting a response',
  promptGuidelines: [
    'Use present_question for free-text, single-choice, and multi-choice prompts; options[] presence determines the response kind.',
    'Use multiple: true when the options are not mutually exclusive; use single-select only when exactly one answer is wanted.',
    'Do not put numbered candidate answers in body markdown when options[] should carry them.',
    'Call request_response after present_question; the runtime derives the request details from this present result.',
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
    return renderEmptyStructuredExchangeCall();
  },

  // ceiling: renderResult is the Markdown pass-through of the formatter's content
  // (D104-L revision 2026-07-02); upgrade path is a details-built TUI-only render
  // if exchange blocks should ever diverge from the content register.
  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
