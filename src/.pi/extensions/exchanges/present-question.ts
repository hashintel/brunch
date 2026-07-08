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
    'Legacy unregistered question presenter kept only for old persisted reads/tests. Use ask for new structured questions.',
  promptSnippet: 'Legacy structured-question presenter; use ask instead',
  promptGuidelines: [
    'Do not call present_question in active Brunch sessions.',
    'Use ask with body/options instead; it carries question and answer in one terminal result.',
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
