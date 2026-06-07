import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectRequestReview, type ReviewDecision } from '../../../projections/exchanges/request-review.js';
import { formatRequestReview } from '../../../renderers/structured-exchange/request-review.js';
import { piSchema } from './pi-schema.js';
import { zRequestReviewParams, type RequestReviewParams } from './schemas/index.js';
import { normalizeOptionalText, renderMarkdownResult } from './shared/markdown.js';

export const REQUEST_REVIEW_TOOL = 'request_review' as const;

const REVIEW_LABELS = ['Approve', 'Request changes', 'Reject'] as const;

function decisionForLabel(label: string): ReviewDecision | undefined {
  if (label === 'Approve') return 'approve';
  if (label === 'Request changes') return 'request_changes';
  if (label === 'Reject') return 'reject';
  return undefined;
}

export const requestReviewTool = defineTool({
  name: REQUEST_REVIEW_TOOL,
  label: 'Request review',
  description:
    'Collect approve / request changes / reject as the request half of a Brunch review-set structured exchange.',
  promptSnippet: 'Request a terminal decision after presenting a graph review set',
  promptGuidelines: [
    'Use request_review only after a successful matching present_review_set result.',
    'Do not repeat the presented review-set markdown in request_review parameters; reference it by exchangeId.',
    'Request-changes decisions require a concrete user comment.',
  ],
  parameters: piSchema(zRequestReviewParams),
  executionMode: 'sequential',

  async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
    const params = zRequestReviewParams.parse(rawParams) satisfies RequestReviewParams;
    const terminal = (status: 'cancelled' | 'unavailable', message?: string) => {
      const details = projectRequestReview({ exchangeId: params.exchangeId, status, message });
      return { content: [{ type: 'text' as const, text: formatRequestReview(details) }], details };
    };

    if (!ctx.hasUI || typeof ctx.ui.select !== 'function') {
      return terminal('unavailable', 'request_review requires interactive UI');
    }

    const selected = await ctx.ui.select(params.prompt ?? 'Review proposal', [...REVIEW_LABELS]);
    if (selected === undefined) return terminal('cancelled');

    const review = decisionForLabel(selected);
    if (!review) return terminal('unavailable', `request_review received unknown decision ${selected}`);

    const comment =
      typeof ctx.ui.input === 'function'
        ? normalizeOptionalText(
            await ctx.ui.input(review === 'request_changes' ? 'Required change request' : 'Optional comment'),
          )
        : undefined;
    if (review === 'request_changes' && comment === undefined) {
      return terminal('unavailable', 'request_review request_changes requires a comment');
    }

    const details = projectRequestReview({
      exchangeId: params.exchangeId,
      status: 'answered',
      review,
      comment,
    });
    return { content: [{ type: 'text' as const, text: formatRequestReview(details) }], details };
  },

  renderCall() {
    return renderMarkdownResult({ content: [] });
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme);
  },
});
