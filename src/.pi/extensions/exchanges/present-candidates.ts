import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatPresentCandidates } from '../../../agents/contexts/exchanges/present-candidates.js';
import { projectPresentCandidates } from '../../../exchanges/projections/present-candidates.js';
import {
  zPresentCandidatesDetails,
  zPresentCandidatesParams,
  type PresentCandidatesParams,
} from '../../../exchanges/schemas/index.js';
import { ExchangeCandidatesResultComponent } from '../../components/exchange-candidates-result.js';
import { piSchema } from './pi-schema.js';
import { renderDetailsOrMarkdownResult } from './shared/details-rendering.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_CANDIDATES_TOOL = 'present_candidates' as const;

export const presentCandidatesTool = defineTool({
  name: PRESENT_CANDIDATES_TOOL,
  label: 'Present candidates',
  description:
    'Persist and display a recognition-only Brunch candidate comparison. Then call ask with continues set to this exchangeId so the runtime collects the declared candidate choice.',
  promptSnippet: 'Present candidate directions for a single user pick',
  promptGuidelines: [
    'Use present_candidates to fan out candidate expressions for comparison, not to commit graph truth.',
    'Choosing a candidate records fan-in intent; it does not commit graph truth or create graph nodes/edges.',
    'Call present_candidates and then ask with continues in the same turn; do not repeat or edit the candidate options.',
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
    return renderEmptyStructuredExchangeCall();
  },

  renderResult(result, _options, theme) {
    return renderDetailsOrMarkdownResult(
      result,
      zPresentCandidatesDetails,
      (details) => new ExchangeCandidatesResultComponent(details, theme),
      () => renderMarkdownResult(result, theme),
    );
  },
});
