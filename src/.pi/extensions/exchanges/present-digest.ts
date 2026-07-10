import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatPresentDigest } from '../../../agents/contexts/exchanges/present-digest.js';
import { projectPresentDigest } from '../../../exchanges/projections/present-digest.js';
import {
  zPresentDigestParams,
  type PresentDigestDetails,
  type PresentDigestParams,
} from '../../../exchanges/schemas/index.js';
import { toolParameters } from '../shared/tool-schema.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';
import { validationFailureResult, type ExchangeValidationFailureDetails } from './shared/validation.js';

export const PRESENT_DIGEST_TOOL = 'present_digest' as const;

const PresentDigestParams = toolParameters(zPresentDigestParams);

type PresentDigestToolDetails = PresentDigestDetails | ExchangeValidationFailureDetails;

export const presentDigestTool = defineTool<typeof PresentDigestParams, PresentDigestToolDetails>({
  name: PRESENT_DIGEST_TOOL,
  label: 'Present digest',
  description:
    'Present a prose digest of large source material for approval, revision, or rejection before any graph mapping.',
  promptSnippet: 'Present a large-source digest for user review',
  promptGuidelines: [
    'Use present_digest for assistant-authored summaries of raw or large source material before mapping it to graph truth.',
    'Carry prose abstract, analysis, and recommendation only; do not include graph nodes, edges, draft ids, or graph command payloads.',
    'Follow with ask using continues set to the same exchangeId; the accepted terminal echoes the abstract for later capture sweep reads.',
    'For the declared review continuation, ask only for approve / request changes / reject; do not repeat the digest body in the ask.',
  ],
  parameters: PresentDigestParams,
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams) {
    const parsed = zPresentDigestParams.safeParse(rawParams);
    if (!parsed.success) return validationFailureResult(PRESENT_DIGEST_TOOL, parsed.error);
    const params = parsed.data satisfies PresentDigestParams;
    const projection = projectPresentDigest(params);
    return {
      content: [{ type: 'text' as const, text: formatPresentDigest(projection) }],
      details: projection.details,
    };
  },

  renderCall() {
    return renderEmptyStructuredExchangeCall();
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
