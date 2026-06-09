import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { latestAssistantText } from './agent-messages.js';

describe('latestAssistantText', () => {
  it('returns the latest assistant text blocks joined in source order', () => {
    const messages = [
      userMessage('Earlier user turn.'),
      fauxAssistantMessage('Earlier assistant turn.'),
      fauxAssistantMessage([
        { type: 'text', text: 'First latest block.' },
        { type: 'thinking', thinking: 'Hidden reasoning.' },
        { type: 'text', text: 'Second latest block.' },
      ]),
    ] satisfies AgentSession['messages'];

    expect(latestAssistantText(messages)).toBe('First latest block.\nSecond latest block.');
  });

  it('ignores non-assistant turns and non-text assistant blocks', () => {
    const messages = [
      userMessage('No assistant text here.'),
      fauxAssistantMessage([fauxToolCall('read_graph', { kind: 'overview' }, { id: 'tool-call-1' })]),
    ] satisfies AgentSession['messages'];

    expect(latestAssistantText(messages)).toBe('');
  });

  it('returns empty text when there are no messages', () => {
    expect(latestAssistantText([])).toBe('');
  });
});

function userMessage(content: string): AgentSession['messages'][number] {
  return { role: 'user', content, timestamp: 0 };
}
