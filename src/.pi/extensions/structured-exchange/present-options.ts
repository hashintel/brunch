import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { markdownEscape, renderMarkdownResult } from './shared/markdown.js';
import { STRUCTURED_EXCHANGE_PRESENT_SCHEMA, type StructuredExchangePresentDetails } from './shared/model.js';

export const PRESENT_OPTIONS_TOOL = 'present_options' as const;

const PresentedOptionSchema = Type.Object({
  id: Type.String({
    description: 'Stable option id for later request_* response correlation.',
  }),
  content: Type.String({ description: 'Markdown-readable option content.' }),
  rationale: Type.Optional(
    Type.String({
      description: 'Why this option is plausible or recommended.',
    }),
  ),
});

export const PresentOptionsParams = Type.Object({
  exchangeId: Type.String({
    description: 'Stable id tying this presented offer to the later request_* response.',
  }),
  heading: Type.String({ description: 'Heading for the presented options.' }),
  body: Type.Optional(Type.String({ description: 'Markdown body shown before the options.' })),
  options: Type.Array(PresentedOptionSchema, {
    description: 'Options to display.',
  }),
  expectedRequestTool: Type.Optional(
    Type.Union([Type.Literal('request_choice'), Type.Literal('request_choices')], {
      description: 'The request_* tool expected to collect the response.',
    }),
  ),
});

interface OptionsMarkdownParams {
  heading: string;
  body?: string;
  options: Array<{
    id: string;
    content: string;
    rationale?: string;
  }>;
}

function optionsMarkdown(params: OptionsMarkdownParams): string {
  const lines = [`## ${params.heading.trim()}`];
  const body = params.body?.trim();
  if (body) lines.push('', body);
  params.options.forEach((option, index) => {
    lines.push('', `### ${index + 1}. ${option.content.trim()}`);
    const rationale = option.rationale?.trim();
    if (rationale) lines.push('', `**Rationale:** ${rationale}`);
    lines.push('', `<!-- option-id: ${markdownEscape(option.id)} -->`);
  });
  return lines.join('\n');
}

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
  parameters: PresentOptionsParams,
  executionMode: 'sequential',

  async execute(toolCallId, params) {
    const markdown = optionsMarkdown(params);
    const details: StructuredExchangePresentDetails = {
      schema: STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
      schemaVersion: 1,
      exchangeId: params.exchangeId,
      presentTool: PRESENT_OPTIONS_TOOL,
      kind: 'options',
      status: 'presented',
      expectedRequest: {
        tool: params.expectedRequestTool ?? 'request_choice',
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
