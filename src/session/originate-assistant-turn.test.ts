import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../graph/schema/elicitation-gaps.js';
import { originateAssistantTurn } from './originate-assistant-turn.js';

const specId = 4;

function fakeManager() {
  const appended: Array<Record<string, unknown>> = [];
  const messages: unknown[] = [];
  return {
    appended,
    messages,
    appendCustomEntry(customType: string, data?: unknown) {
      appended.push({ type: 'custom', customType, data });
      return 'id';
    },
    appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
      appended.push({ type: 'custom_message', customType, content, details });
      return 'id';
    },
    appendMessage(message: unknown) {
      messages.push(message);
      return 'id';
    },
  };
}

function reads(lsn: number, gaps: readonly ElicitationGap[] = []) {
  return {
    queryGraph: () => ({ nodes: [], edges: [], lsn }) as never,
    getElicitationGaps: () => gaps,
  };
}

const continuityOnlyEntries = [
  { type: 'custom', customType: 'brunch.session_binding', data: { specId } },
  {
    type: 'custom_message',
    customType: 'brunch.context_seed',
    content: 'seeded',
    details: { specId, snapshotLsn: 1 },
  },
  { type: 'custom', customType: 'worldUpdate', data: { specId, currentLsn: 2 } },
  { type: 'custom', customType: 'brunch.agent_runtime_state', data: {} },
];

describe('originateAssistantTurn', () => {
  it('derives new_session from projected transcript state, never from entry counts', () => {
    const manager = fakeManager();
    // More than three entries, none conversational: still a new session.
    const result = originateAssistantTurn({
      specId,
      reads: reads(3),
      entries: continuityOnlyEntries,
      resumeOrigin: 'manual_trigger',
      exchangeOrdinal: 0,
      manager,
    });

    expect(result.decision.action).toBe('start');
    expect(result.decision.action === 'start' && result.decision.origin).toBe('new_session');
  });

  it('derives the caller-named resume origin when conversational messages exist', () => {
    const manager = fakeManager();
    const result = originateAssistantTurn({
      specId,
      reads: reads(3),
      entries: [{ type: 'message', message: { role: 'assistant', content: 'Hi', timestamp: 0 } }],
      resumeOrigin: 'manual_trigger',
      exchangeOrdinal: 1,
      manager,
    });

    expect(result.decision.action === 'start' && result.decision.origin).toBe('manual_trigger');
  });

  it('seeds composed content and appends the present_* exchange on start', () => {
    const manager = fakeManager();
    const result = originateAssistantTurn({
      specId,
      specName: 'Issue tracker',
      reads: reads(5),
      entries: [],
      resumeOrigin: 'resume_debt',
      exchangeOrdinal: 0,
      manager,
    });

    const seed = manager.appended.find((entry) => entry.customType === 'brunch.context_seed');
    expect(seed?.type).toBe('custom_message');
    expect(String(seed?.content)).toContain('Issue tracker');
    expect(String(seed?.content)).toContain('LSN 5');
    expect(manager.messages).toHaveLength(1);
    expect(result.exchange).toBeDefined();
  });

  it('appends no exchange when the decision is idle', () => {
    const manager = fakeManager();
    const result = originateAssistantTurn({
      specId,
      reads: reads(1),
      entries: [
        {
          type: 'message',
          message: {
            role: 'toolResult',
            toolName: 'request_clarification',
            details: { answered: { choices: [] } },
            timestamp: 0,
          },
        },
      ],
      resumeOrigin: 'resume_debt',
      exchangeOrdinal: 2,
      manager,
    });

    expect(result.decision.action).toBe('idle');
    expect(manager.messages).toHaveLength(0);
    expect(result.exchange).toBeUndefined();
  });
});
