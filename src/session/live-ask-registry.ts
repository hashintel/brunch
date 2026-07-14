import {
  zQuestionnaireSubmissionFor,
  type AskQuestionEcho,
  type QuestionnaireQuestion,
} from '../exchanges/schemas/index.js';
import type { LiveExchangeAnswerer, LiveExchangeAwaiter } from './live-exchange-broker.js';

/**
 * Live ask registry — the single runtime source of open-ask truth for one
 * process (A39-L). It generalizes the exchange broker's in-flight `pending`
 * map into observable state that additionally carries each open ask's payload,
 * so a headless RPC client can discover open asks without scanning the
 * transcript. The `awaitAnswer` / `submitAnswer` broker contract is preserved
 * verbatim (`LiveExchangeAwaiter` / `LiveExchangeAnswerer`); the payload-aware
 * `opener` path is added alongside it and shares the same pending rendezvous.
 *
 * In-memory and process-local by design: open asks do not survive a restart, so
 * a resumed process rediscovers nothing and a pre-restart exchange id reads
 * `closed` rather than hanging.
 */

export type OpenAskMode = 'text' | 'single-select' | 'multi-select' | 'questionnaire' | 'review';

export interface OpenAsk {
  readonly exchangeId: string;
  readonly mode: OpenAskMode;
  readonly question: AskQuestionEcho & { readonly questions?: readonly QuestionnaireQuestion[] };
}

export type AskLifecycleState = 'open' | 'answered' | 'cancelled' | 'closed';

export interface LiveAskReader {
  openAsks(): readonly OpenAsk[];
  stateOf(exchangeId: string): AskLifecycleState;
}

export interface LiveAskOpener {
  /**
   * Register an open ask carrying its payload and await its headless answer.
   * Resolves to the answer string on submit, or `undefined` when the ask is
   * cancelled (matching the broker's cancellation channel).
   */
  openAsk(ask: OpenAsk): Promise<string | undefined>;
}

export interface LiveAskRegistry {
  readonly awaiter: LiveExchangeAwaiter;
  readonly answerer: LiveExchangeAnswerer;
  readonly opener: LiveAskOpener;
  readonly reader: LiveAskReader;
  cancel(exchangeId: string): void;
  cancelAll(): void;
}

interface PendingEntry {
  readonly resolve: (answer: string | undefined) => void;
  readonly ask?: OpenAsk;
}

export function createLiveAskRegistry(): LiveAskRegistry {
  const pending = new Map<string, PendingEntry>();
  // ceiling: terminal states retained unbounded for the process lifetime so a
  // just-answered/cancelled id stays distinguishable from an unknown one; a
  // long-lived headless session should bound this to a rolling window.
  const terminal = new Map<string, Extract<AskLifecycleState, 'answered' | 'cancelled'>>();

  function register(exchangeId: string, ask?: OpenAsk): Promise<string | undefined> {
    if (pending.has(exchangeId)) {
      throw new Error(`Live exchange is already pending: ${exchangeId}`);
    }
    return new Promise<string | undefined>((resolve) => {
      pending.set(exchangeId, ask ? { resolve, ask } : { resolve });
    });
  }

  function settle(exchangeId: string, state: 'answered' | 'cancelled', answer: string | undefined): void {
    const entry = pending.get(exchangeId);
    if (!entry) return;
    // Transition synchronously so a read taken right after submit/cancel already
    // reflects the terminal state; a client must never see an answered ask still
    // listed as open.
    pending.delete(exchangeId);
    terminal.set(exchangeId, state);
    entry.resolve(answer);
  }

  return {
    awaiter: {
      awaitAnswer({ exchangeId }) {
        return register(exchangeId);
      },
    },
    answerer: {
      submitAnswer({ exchangeId, answer }) {
        const entry = pending.get(exchangeId);
        if (!entry) return { submitted: false, reason: 'no_pending_exchange' };
        if (entry.ask?.mode === 'questionnaire') {
          try {
            if (
              !entry.ask.question.questions ||
              !zQuestionnaireSubmissionFor(entry.ask.question.questions).safeParse(JSON.parse(answer)).success
            )
              return { submitted: false, reason: 'invalid_answer' };
          } catch {
            return { submitted: false, reason: 'invalid_answer' };
          }
        }
        settle(exchangeId, 'answered', answer);
        return { submitted: true };
      },
    },
    opener: {
      openAsk(ask) {
        return register(ask.exchangeId, ask);
      },
    },
    reader: {
      openAsks() {
        return [...pending.values()].flatMap((entry) => (entry.ask ? [entry.ask] : []));
      },
      stateOf(exchangeId) {
        if (pending.has(exchangeId)) return 'open';
        return terminal.get(exchangeId) ?? 'closed';
      },
    },
    cancel(exchangeId) {
      settle(exchangeId, 'cancelled', undefined);
    },
    cancelAll() {
      // Snapshot keys: settle() deletes from `pending` as each promise finalizes.
      for (const exchangeId of Array.from(pending.keys())) {
        settle(exchangeId, 'cancelled', undefined);
      }
    },
  };
}
