import { formatRequestAnswer } from '../../../../agents/contexts/exchanges/request-response.js';
import { projectRequestAnswer } from '../../../../exchanges/projections/request-response.js';
import type { LiveExchangeAwaiter } from '../../../../session/live-exchange-broker.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

export interface CollectAnswerParams {
  readonly ctx: StructuredExchangeUiContext;
  readonly answerBroker?: LiveExchangeAwaiter | undefined;
  readonly exchangeId: string;
  readonly prompt: string;
  readonly unavailableMessage: string;
}

export async function collectAnswerFromSources({
  ctx,
  answerBroker,
  exchangeId,
  prompt,
  unavailableMessage,
}: CollectAnswerParams) {
  let answer: string | undefined;
  if (ctx.hasUI && typeof ctx.ui?.editor === 'function') {
    answer = await ctx.ui.editor(prompt);
  } else if (answerBroker) {
    answer = await answerBroker.awaitAnswer({ exchangeId });
  } else {
    const details = projectRequestAnswer({ exchangeId, status: 'unavailable', message: unavailableMessage });
    return { content: [{ type: 'text' as const, text: formatRequestAnswer(details) }], details };
  }

  const details =
    answer === undefined
      ? projectRequestAnswer({ exchangeId, status: 'cancelled' })
      : projectRequestAnswer({ exchangeId, status: 'answered', answer });
  return { content: [{ type: 'text' as const, text: formatRequestAnswer(details) }], details };
}
