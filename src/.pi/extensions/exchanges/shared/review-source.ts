import { formatRequestReview } from '../../../../agents/contexts/exchanges/request-response.js';
import {
  projectRequestReview,
  type ReviewDecision,
} from '../../../../exchanges/projections/request-response.js';
import { createExchangeDecisionPickerComponent } from '../../../components/exchange-decision-picker.js';
import { normalizeOptionalText } from './markdown.js';
import { collectRequiredInput } from './required-input.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

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

  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function') {
    return terminal('unavailable', 'request_response review requires interactive UI');
  }

  const selected = await ctx.ui.custom<{ readonly id: ReviewDecision } | undefined>(
    (_tui, theme, _keybindings, done) =>
      createExchangeDecisionPickerComponent({
        prompt: params.prompt,
        choices: REVIEW_CHOICES,
        theme,
        onDone: (result) => done(result as { readonly id: ReviewDecision } | undefined),
      }),
  );
  if (selected === undefined) return terminal('cancelled');

  const review = selected.id;

  let comment: string | undefined;
  if (review === 'request_changes') {
    comment = await collectRequiredInput(ctx, 'Required change request');
    if (comment === undefined) return terminal('cancelled');
  } else if (typeof ctx.ui.input === 'function') {
    comment = normalizeOptionalText(await ctx.ui.input('Optional comment'));
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

const REVIEW_CHOICES: readonly { readonly id: ReviewDecision; readonly label: string }[] = [
  { id: 'approve', label: 'Approve' },
  { id: 'request_changes', label: 'Request changes' },
  { id: 'reject', label: 'Reject' },
];
