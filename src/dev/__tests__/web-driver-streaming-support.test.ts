import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assembleAssistantTextFromStream } from './web-driver-streaming-support.js';

function event(value: unknown): AgentSessionEvent {
  return value as AgentSessionEvent;
}

describe('assembleAssistantTextFromStream', () => {
  it('skips malformed message-bearing events while preserving valid cumulative assistant text', () => {
    const events = [
      event({ type: 'message_update' }),
      event({ type: 'message_end', message: { role: 'assistant', content: 'not-an-array' } }),
      event({
        type: 'message_update',
        message: { role: 'assistant', content: [{ type: 'text', text: 'valid' }] },
      }),
      event({
        type: 'message_end',
        message: { role: 'user', content: [{ type: 'text', text: 'ignored user text' }] },
      }),
      event({
        type: 'message_update',
        message: { role: 'assistant', content: [{ type: 'text', text: 'short' }] },
      }),
      event({
        type: 'message_end',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'valid assistant' },
            { type: 'thinking', thinking: 'ignored thinking' },
            { type: 'text', text: 'text' },
          ],
        },
      }),
    ];

    expect(() => assembleAssistantTextFromStream(events)).not.toThrow();
    expect(assembleAssistantTextFromStream(events)).toBe('valid assistant\ntext');
  });
});
