export type LiveExchangeAnswerOutcome =
  | { readonly submitted: true }
  | { readonly submitted: false; readonly reason: 'no_pending_exchange' };

export interface LiveExchangeAwaiter {
  awaitAnswer(input: { readonly exchangeId: string }): Promise<string | undefined>;
}

export interface LiveExchangeAnswerer {
  submitAnswer(input: { readonly exchangeId: string; readonly answer: string }): LiveExchangeAnswerOutcome;
}

export interface LiveExchangeBroker {
  readonly awaiter: LiveExchangeAwaiter;
  readonly answerer: LiveExchangeAnswerer;
}

interface PendingAnswer {
  readonly resolve: (answer: string | undefined) => void;
}

export function createLiveExchangeBroker(): LiveExchangeBroker {
  const pending = new Map<string, PendingAnswer>();

  return {
    awaiter: {
      awaitAnswer({ exchangeId }) {
        if (pending.has(exchangeId)) {
          throw new Error(`Live exchange is already pending: ${exchangeId}`);
        }
        return new Promise<string | undefined>((resolve) => {
          pending.set(exchangeId, { resolve });
        }).finally(() => {
          pending.delete(exchangeId);
        });
      },
    },
    answerer: {
      submitAnswer({ exchangeId, answer }) {
        const match = pending.get(exchangeId);
        if (!match) return { submitted: false, reason: 'no_pending_exchange' };
        match.resolve(answer);
        return { submitted: true };
      },
    },
  };
}
