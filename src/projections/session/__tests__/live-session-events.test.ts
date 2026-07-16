import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { createLiveSessionEventProjection } from '../live-session-events.js';

const event = (value: object) => value as AgentSessionEvent;

describe('live session event projection', () => {
  it('uses agent_settled, not agent_end, as the convergence boundary', () => {
    const project = createLiveSessionEventProjection();
    expect(project(event({ type: 'agent_start' }))).toBeNull();
    expect(
      project(
        event({
          type: 'message_update',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
        }),
      ),
    ).toEqual({ type: 'assistant_text_delta', runId: 'run:1', text: 'Hello' });
    expect(project(event({ type: 'agent_end' }))).toBeNull();
    expect(project(event({ type: 'agent_settled' }))).toEqual({ type: 'agent_settled' });
  });

  it('emits only cumulative suffixes under one run anchor before settlement', () => {
    const project = createLiveSessionEventProjection();
    project(event({ type: 'agent_start' }));
    const update = (text: string) =>
      project(
        event({
          type: 'message_update',
          message: { role: 'assistant', content: [{ type: 'text', text }] },
        }),
      );
    expect(update('Hel')).toEqual({ type: 'assistant_text_delta', runId: 'run:1', text: 'Hel' });
    expect(update('Hello')).toEqual({ type: 'assistant_text_delta', runId: 'run:1', text: 'lo' });
    expect(project(event({ type: 'agent_settled' }))).toEqual({ type: 'agent_settled' });
  });
});
