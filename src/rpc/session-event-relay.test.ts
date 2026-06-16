import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { BRUNCH_SESSION_EVENT_METHOD, createSessionEventRelay } from './session-event-relay.js';

function event(type: AgentSessionEvent['type']): AgentSessionEvent {
  return { type } as AgentSessionEvent;
}

function source() {
  const listeners = new Set<(event: AgentSessionEvent) => void>();
  return {
    emit(value: AgentSessionEvent) {
      for (const listener of listeners) listener(value);
    },
    listenerCount() {
      return listeners.size;
    },
    session: {
      subscribe(listener: (value: AgentSessionEvent) => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}

describe('SessionEventRelay', () => {
  it('forwards live AgentSession events in a Brunch-owned JSON-RPC notification envelope', () => {
    const relay = createSessionEventRelay();
    const session = source();
    const received: unknown[] = [];

    relay.subscribe((frame) => received.push(frame));
    relay.attachSession(session.session);
    session.emit(event('agent_start'));
    session.emit(event('agent_end'));

    expect(received).toEqual([
      {
        jsonrpc: '2.0',
        method: BRUNCH_SESSION_EVENT_METHOD,
        params: { seq: 0, event: event('agent_start') },
      },
      { jsonrpc: '2.0', method: BRUNCH_SESSION_EVENT_METHOD, params: { seq: 1, event: event('agent_end') } },
    ]);
  });

  it('does not replay retained events to later subscribers', () => {
    const relay = createSessionEventRelay();
    const session = source();
    relay.attachSession(session.session);
    session.emit(event('agent_start'));

    const received: unknown[] = [];
    relay.subscribe((frame) => received.push(frame));

    expect(received).toEqual([]);
  });

  it('unsubscribes listeners and the attached source explicitly', () => {
    const relay = createSessionEventRelay();
    const session = source();
    const received: unknown[] = [];

    const detachListener = relay.subscribe((frame) => received.push(frame));
    const detachSession = relay.attachSession(session.session);
    expect(session.listenerCount()).toBe(1);

    detachListener();
    session.emit(event('turn_start'));
    expect(received).toEqual([]);

    detachSession();
    expect(session.listenerCount()).toBe(0);
  });
});
