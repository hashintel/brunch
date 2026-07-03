import { describe, expect, it } from 'vitest';

import {
  completeAssistantKick,
  kickTurnMessage,
  originateAssistantTurn,
} from '../originate-assistant-turn.js';

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

function reads(lsn: number) {
  return {
    queryGraph: () => ({ nodes: [], edges: [], lsn }) as never,
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
      workspaceContext: '',
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
      workspaceContext: '',
      manager,
    });

    expect(result.decision.action === 'start' && result.decision.origin).toBe('manual_trigger');
  });

  it('seeds composed content and fabricates no exchange on start (D78-L revised)', () => {
    const manager = fakeManager();
    const result = originateAssistantTurn({
      specId,
      specName: 'Issue tracker',
      reads: reads(5),
      entries: [],
      resumeOrigin: 'resume_debt',
      workspaceContext: 'Workspace overview (fixture)',
      manager,
    });

    const seed = manager.appended.find((entry) => entry.customType === 'brunch.context_seed');
    expect(seed?.type).toBe('custom_message');
    expect(String(seed?.content)).toContain('Issue tracker');
    expect(String(seed?.content)).toContain('LSN 5');
    expect(String(seed?.content)).toContain('Workspace overview (fixture)');
    // The product mints no present_* offer: origination is seed-only, and the
    // launch path's kick turn lets the assistant author the opening live.
    expect(result.decision.action).toBe('start');
    expect(manager.appended.some((entry) => String(entry.customType).startsWith('present_'))).toBe(false);
  });

  it('appends nothing beyond continuity when the decision is idle', () => {
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
      workspaceContext: '',
      manager,
    });

    expect(result.decision.action).toBe('idle');
  });

  it('folds a fresh orientation choice into the seed content', () => {
    const manager = fakeManager();
    const entries = [
      {
        type: 'custom',
        customType: 'brunch.session_orientation',
        data: { schemaVersion: 1, choice: 'ingest', trigger: 'entry' },
      },
    ];
    originateAssistantTurn({
      specId,
      reads: reads(2),
      entries,
      resumeOrigin: 'resume_debt',
      workspaceContext: '',
      manager,
    });

    const seed = manager.appended.find((entry) => entry.customType === 'brunch.context_seed');
    expect(String(seed?.content)).toContain('SESSION ORIENTATION');
    expect(String(seed?.content)).toContain('chosen: ingest');
  });

  it('never re-routes a kick with an orientation choice recorded before the last kick', () => {
    const manager = fakeManager();
    const entries = [
      {
        type: 'custom',
        customType: 'brunch.session_orientation',
        data: { schemaVersion: 1, choice: 'ingest', trigger: 'entry' },
      },
      {
        type: 'custom_message',
        customType: 'brunch.kick',
        content: 'kick',
        details: { origin: 'new_session' },
      },
    ];
    originateAssistantTurn({
      specId,
      reads: reads(2),
      entries,
      resumeOrigin: 'manual_trigger',
      workspaceContext: '',
      manager,
    });

    const seed = manager.appended.find((entry) => entry.customType === 'brunch.context_seed');
    expect(String(seed?.content)).not.toContain('SESSION ORIENTATION');
  });
});

describe('kickTurnMessage', () => {
  it('locks the D78-L assistant-authored opening copy', () => {
    // D78-L: the product seeds context, then asks the assistant to author the
    // opening live; it must not imply a product-fabricated offer already exists.
    expect(kickTurnMessage('new_session')).toEqual({
      customType: 'brunch.kick',
      content:
        'Session start: the spec context has been seeded into the transcript for you. ' +
        'Open the conversation in your own words, grounded in that seeded context, ' +
        'and lead the user toward the first structured question.',
      display: false,
      details: { origin: 'new_session' },
    });
    expect(kickTurnMessage('new_session').content).not.toContain('presented offer');
    expect(kickTurnMessage('new_session').content).not.toContain('offered question');
  });
});

describe('completeAssistantKick', () => {
  it('fires a start decision and reports exactly one fired outcome', async () => {
    const sent: unknown[] = [];
    const outcomes: unknown[] = [];

    await completeAssistantKick({
      decision: { action: 'start', origin: 'new_session', seedEntries: [] },
      modelAvailable: true,
      sendCustomMessage: async (message, options) => {
        sent.push({ message, options });
      },
      onOutcome: (outcome) => outcomes.push(outcome),
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      message: { customType: 'brunch.kick', details: { origin: 'new_session' } },
      options: { triggerTurn: true },
    });
    expect(outcomes).toEqual([{ status: 'fired', origin: 'new_session' }]);
  });

  it('classifies no-model and idle skips without sending a kick', async () => {
    const sent: unknown[] = [];
    const outcomes: unknown[] = [];

    await completeAssistantKick({
      decision: { action: 'start', origin: 'resume_debt', seedEntries: [] },
      modelAvailable: false,
      sendCustomMessage: async (message) => sent.push(message),
      onOutcome: (outcome) => outcomes.push(outcome),
    });
    await completeAssistantKick({
      decision: { action: 'idle', reason: 'no_unresolved_debt', seedEntries: [] },
      modelAvailable: true,
      sendCustomMessage: async (message) => sent.push(message),
      onOutcome: (outcome) => outcomes.push(outcome),
    });

    expect(sent).toEqual([]);
    expect(outcomes).toEqual([
      { status: 'skipped', reason: 'no_model_available' },
      { status: 'skipped', reason: 'idle_no_unresolved_debt' },
    ]);
  });

  it('routes kick failures through the outcome sink', async () => {
    const error = new Error('provider rejected');
    const outcomes: unknown[] = [];

    await completeAssistantKick({
      decision: { action: 'start', origin: 'manual_trigger', seedEntries: [] },
      modelAvailable: true,
      sendCustomMessage: async () => {
        throw error;
      },
      onOutcome: (outcome) => outcomes.push(outcome),
    });

    expect(outcomes).toEqual([{ status: 'failed', origin: 'manual_trigger', error }]);
  });
});
