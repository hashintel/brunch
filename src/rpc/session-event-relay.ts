import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

export const BRUNCH_SESSION_EVENT_METHOD = 'brunch.sessionEvent';

export interface SessionEventRelayFrame {
  readonly jsonrpc: '2.0';
  readonly method: typeof BRUNCH_SESSION_EVENT_METHOD;
  readonly params: {
    readonly seq: number;
    readonly event: AgentSessionEvent;
  };
}

type SessionEventRelayListener = (frame: SessionEventRelayFrame) => void;

type AgentSessionEventSource = {
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
};

export interface SessionEventRelay {
  attachSession(session: AgentSessionEventSource): () => void;
  subscribe(listener: SessionEventRelayListener): () => void;
}

export function createSessionEventRelay(): SessionEventRelay {
  const listeners = new Set<SessionEventRelayListener>();
  let seq = 0;
  let detachCurrentSession: (() => void) | undefined;

  return {
    attachSession(session) {
      detachCurrentSession?.();
      const unsubscribe = session.subscribe((event) => {
        const frame = createSessionEventRelayFrame(seq, event);
        seq += 1;
        for (const listener of listeners) listener(frame);
      });
      detachCurrentSession = unsubscribe;
      return () => {
        if (detachCurrentSession !== unsubscribe) return;
        detachCurrentSession = undefined;
        unsubscribe();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createSessionEventRelayFrame(seq: number, event: AgentSessionEvent): SessionEventRelayFrame {
  return {
    jsonrpc: '2.0',
    method: BRUNCH_SESSION_EVENT_METHOD,
    params: { seq, event },
  };
}
