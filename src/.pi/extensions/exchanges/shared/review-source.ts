import { formatRequestReview } from '../../../../agents/contexts/exchanges/request-response.js';
import {
  projectRequestReview,
  type ReviewDecision,
} from '../../../../exchanges/projections/request-response.js';
import { normalizeOptionalText } from './markdown.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

const REVIEW_LABELS = ['Approve', 'Request changes', 'Reject'] as const;

function decisionForLabel(label: string): ReviewDecision | undefined {
  if (label === 'Approve') return 'approve';
  if (label === 'Request changes') return 'request_changes';
  if (label === 'Reject') return 'reject';
  return undefined;
}

export type CollectReviewParams =
  | {
      readonly exchangeId: string;
      readonly prompt: string;
      readonly respondsToPresentTool: 'present_review_set';
    }
  | {
      readonly exchangeId: string;
      readonly prompt: string;
      readonly respondsToPresentTool: 'present_digest';
      readonly acceptedAbstract: string;
    };
export async function collectReviewFromUi(ctx: StructuredExchangeUiContext, params: CollectReviewParams) {
  const terminal = (status: 'cancelled' | 'unavailable', message?: string) => {
    const details = projectRequestReview({
      exchangeId: params.exchangeId,
      status,
      respondsToPresentTool: params.respondsToPresentTool,
      ...(message !== undefined ? { message } : {}),
    });
    return {
      content: [{ type: 'text' as const, text: formatRequestReview(details) }],
      details,
      // A user cancel means "leave me inert": end the turn on this tool
      // result. Unavailable stays reactive so the model can reroute.
      ...(status === 'cancelled' ? { terminate: true } : {}),
    };
  };

  if (!ctx.hasUI || typeof ctx.ui?.select !== 'function') {
    return terminal('unavailable', 'request_response review requires interactive UI');
  }

  const selected = await ctx.ui.select(params.prompt, [...REVIEW_LABELS]);
  if (selected === undefined) return terminal('cancelled');

  const review = decisionForLabel(selected);
  if (!review)
    return terminal('unavailable', `request_response review received unknown decision ${selected}`);

  const comment =
    typeof ctx.ui.input === 'function'
      ? normalizeOptionalText(
          await ctx.ui.input(review === 'request_changes' ? 'Required change request' : 'Optional comment'),
        )
      : undefined;
  if (review === 'request_changes' && comment === undefined) {
    return terminal('unavailable', 'request_response review change request requires a comment');
  }

  if (review === 'approve') {
    const details =
      params.respondsToPresentTool === 'present_digest'
        ? projectRequestReview({
            exchangeId: params.exchangeId,
            status: 'answered',
            review,
            respondsToPresentTool: params.respondsToPresentTool,
            acceptedAbstract: params.acceptedAbstract,
            ...(comment !== undefined ? { comment } : {}),
          })
        : projectRequestReview({
            exchangeId: params.exchangeId,
            status: 'answered',
            review,
            respondsToPresentTool: params.respondsToPresentTool,
            ...(comment !== undefined ? { comment } : {}),
          });
    return { content: [{ type: 'text' as const, text: formatRequestReview(details) }], details };
  }

  const details = projectRequestReview({
    exchangeId: params.exchangeId,
    status: 'answered',
    review,
    respondsToPresentTool: params.respondsToPresentTool,
    ...(comment !== undefined ? { comment } : {}),
  });
  return { content: [{ type: 'text' as const, text: formatRequestReview(details) }], details };
}
