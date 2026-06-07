import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectPresentOptions } from '../../../projections/exchanges/present-options.js';
import { formatPresentOptions } from '../../../renderers/structured-exchange/present-options.js';
import { piSchema } from './pi-schema.js';
import { zPresentOptionsParams, type PresentOptionsParams } from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_OPTIONS_TOOL = 'present_options' as const;

export const presentOptionsTool = defineTool({
  name: PRESENT_OPTIONS_TOOL,
  label: 'Present options',
  description:
    'Persist and display a set of structured options as the present half of a Brunch structured exchange. Call the matching request_choice/request_choices tool after this result is available.',
  promptSnippet: 'Present structured options before requesting a choice',
  promptGuidelines: [
    'Use present_options before request_choice or request_choices.',
    'Do not rely on renderCall for semantic display; the durable offer is this tool result.',
  ],
  parameters: piSchema(zPresentOptionsParams),
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams) {
    const params = zPresentOptionsParams.parse(rawParams) satisfies PresentOptionsParams;
    const projection = projectPresentOptions(params);
    return {
      content: [{ type: 'text' as const, text: formatPresentOptions(projection) }],
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
