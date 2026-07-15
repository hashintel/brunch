/**
 * Live exchange broker contract — the process-local ask-answer rendezvous types.
 * The concrete implementation is the live ask registry (`live-ask-registry.ts`,
 * D125-L), which owns the pending rendezvous plus observable open-ask state; this
 * module keeps the narrow `awaitAnswer` / `submitAnswer` string contract that the
 * `session.answerExchange` RPC handle and the registry both speak.
 */

export type LiveExchangeAnswerOutcome =
  | { readonly submitted: true }
  | { readonly submitted: false; readonly reason: 'no_pending_exchange' };

export interface LiveExchangeAwaiter {
  awaitAnswer(input: { readonly exchangeId: string }): Promise<string | undefined>;
}

export interface LiveExchangeAnswerer {
  submitAnswer(input: { readonly exchangeId: string; readonly answer: string }): LiveExchangeAnswerOutcome;
}
