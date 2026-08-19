import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

import { createLiveSessionEventProjection } from '../projections/session/live-session-events.js';
import type { LiveAskRegistry } from './live-ask-registry.js';
import {
  sameSessionTarget,
  type LiveSessionEvent,
  type LiveSessionHost,
  type SessionTarget,
} from './live-session-host.js';

export interface TuiAdaptedSession {
  readonly isStreaming: boolean;
  prompt(
    text: string,
    options: { readonly expandPromptTemplates: false; readonly source: 'rpc' },
  ): Promise<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
}

export interface TuiLiveSessionAdapter extends LiveSessionHost {
  attachSession(session: TuiAdaptedSession): void;
  detachSession(): void;
}

/** Adapts the exact InteractiveMode-owned session; it never creates or disposes a Pi runtime. */
export function createTuiLiveSessionAdapter(input: {
  readonly target: SessionTarget;
  readonly asks: LiveAskRegistry;
}): TuiLiveSessionAdapter {
  const listeners = new Set<(event: LiveSessionEvent) => void>();
  let session: TuiAdaptedSession | null = null;
  let unsubscribeSession: (() => void) | undefined;
  let unsubscribeAsks: (() => void) | undefined;
  let driverId: string | null = null;
  let seq = 0;

  const emit = (delta: LiveSessionEvent['delta']) => {
    const event = { target: input.target, seq: seq++, delta };
    for (const listener of listeners) listener(event);
  };

  const matches = (target: SessionTarget) => sameSessionTarget(target, input.target);

  return {
    attachSession(next) {
      unsubscribeSession?.();
      unsubscribeAsks?.();
      session = next;
      driverId = null;
      seq = 0;
      const project = createLiveSessionEventProjection();
      unsubscribeSession = next.subscribe((event) => {
        const delta = project(event);
        if (delta) emit(delta);
      });
      unsubscribeAsks = input.asks.subscribe((ask) => emit({ type: 'ask_opened', ask }));
    },
    detachSession() {
      unsubscribeSession?.();
      unsubscribeAsks?.();
      unsubscribeSession = undefined;
      unsubscribeAsks = undefined;
      driverId = null;
      session = null;
    },
    async open(target) {
      return { status: matches(target) && session ? 'attached' : 'not_open' };
    },
    async close(target) {
      if (!matches(target) || !session) return { status: 'not_open' };
      if (session.isStreaming) return { status: 'busy' };
      driverId = null;
      return { status: 'closed' };
    },
    async driveTurn(target, nextDriverId, prompt) {
      if (!matches(target) || !session) return { status: 'not_open' };
      if (driverId !== null && driverId !== nextDriverId) return { status: 'driver_conflict' };
      if (session.isStreaming) return { status: 'busy' };
      driverId = nextDriverId;
      await session.prompt(prompt, { expandPromptTemplates: false, source: 'rpc' });
      return { status: 'completed' };
    },
    openAsks(target) {
      return matches(target) && session ? input.asks.reader.openAsks() : undefined;
    },
    answerExchange(target, nextDriverId, exchangeId, answer) {
      if (!matches(target) || !session) return { status: 'not_open' };
      if (driverId !== null && driverId !== nextDriverId) return { status: 'driver_conflict' };
      driverId = nextDriverId;
      const outcome = input.asks.answerer.submitAnswer({ exchangeId, answer });
      if (outcome.submitted) return { status: 'completed' };
      return { status: outcome.reason === 'invalid_answer' ? 'invalid_answer' : 'ask_closed' };
    },
    subscribeAll(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async dispose() {
      unsubscribeSession?.();
      unsubscribeAsks?.();
      driverId = null;
      session = null;
      listeners.clear();
    },
  };
}
