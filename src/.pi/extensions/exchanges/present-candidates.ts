import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatPresentCandidates } from '../../../agents/contexts/exchanges/present-candidates.js';
import { projectPresentCandidates } from '../../../projections/exchanges/present-candidates.js';
import { piSchema } from './pi-schema.js';
import { zPresentCandidatesParams, type PresentCandidatesParams } from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_CANDIDATES_TOOL = 'present_candidates' as const;

export const presentCandidatesTool = defineTool({
  name: PRESENT_CANDIDATES_TOOL,
  label: 'Present candidates',
  description:
    'Persist and display a recognition-only Brunch candidate comparison. Call request_response after this result is available so the user can pick one candidate.',
  promptSnippet: 'Present candidate directions for a single user pick',
  promptGuidelines: [
    'Use present_candidates to fan out candidate expressions for comparison, not to commit graph truth.',
    'Choosing a candidate records fan-in intent; it does not commit graph truth or create graph nodes/edges.',
    'Call request_response after present_candidates; the runtime derives the candidate-choice request details from this present result.',
    'Do not add fan_in_mode, scalar ratings, grounding prose, caveats, or graph writes to this presentation.',
  ],
  parameters: piSchema(zPresentCandidatesParams),
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams) {
    const params = zPresentCandidatesParams.parse(rawParams) satisfies PresentCandidatesParams;
    const projection = projectPresentCandidates(params);
    return {
      content: [{ type: 'text' as const, text: formatPresentCandidates(projection) }],
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
