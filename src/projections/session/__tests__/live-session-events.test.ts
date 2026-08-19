import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { createLiveSessionEventProjection } from '../live-session-events.js';

const event = (value: object) => value as AgentSessionEvent;

describe('live session event projection', () => {
  it('projects direct text deltas under one run anchor until agent_settled', () => {
    const project = createLiveSessionEventProjection();
    expect(project(event({ type: 'agent_start' }))).toBeNull();
    expect(
      project(
        event({
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'Hel' },
        }),
      ),
    ).toEqual({ type: 'assistant_text_delta', runId: 'run:1', text: 'Hel' });
    expect(
      project(
        event({
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'lo' },
        }),
      ),
    ).toEqual({ type: 'assistant_text_delta', runId: 'run:1', text: 'lo' });
    expect(project(event({ type: 'agent_end' }))).toBeNull();
    expect(project(event({ type: 'agent_settled' }))).toEqual({ type: 'agent_settled' });
  });

  it('increments run ids and rejects non-text or malformed update rivals', () => {
    const project = createLiveSessionEventProjection();
    project(event({ type: 'agent_start' }));
    expect(
      project(
        event({
          type: 'message_update',
          assistantMessageEvent: { type: 'thinking_delta', delta: 'private' },
        }),
      ),
    ).toBeNull();
    expect(project(event({ type: 'message_update', assistantMessageEvent: null }))).toBeNull();
    expect(project(event({ type: 'agent_start' }))).toBeNull();
    expect(
      project(
        event({
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta: 'Next' },
        }),
      ),
    ).toEqual({ type: 'assistant_text_delta', runId: 'run:2', text: 'Next' });
  });
});
