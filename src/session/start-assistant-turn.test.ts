import { describe, expect, it } from 'vitest';

import { startAssistantTurn, latestTailOwesAssistant } from './start-assistant-turn.js';

const specId = 5;

function custom(customType: string, data: Record<string, unknown> = {}) {
  return { type: 'custom', customType, data };
}

function message(role: 'user' | 'assistant', content: string) {
  return { type: 'message', message: { role, content, timestamp: 0 } };
}

function toolResult(toolName: string, details: Record<string, unknown> = {}) {
  return { type: 'message', message: { role: 'toolResult', toolName, details, timestamp: 0 } };
}

describe('startAssistantTurn', () => {
  it('seeds and starts a new assistant-originated session without fabricating a user turn', () => {
    const decision = startAssistantTurn({
      specId,
      currentLsn: 3,
      entries: [],
      origin: 'new_session',
      strategy: 'auto',
    });

    expect(decision).toEqual({
      action: 'start',
      origin: 'new_session',
      seedEntries: [{ type: 'custom', customType: 'brunch.context_seed', data: { specId, snapshotLsn: 3 } }],
    });
    expect(JSON.stringify(decision)).not.toContain('"role":"user"');
  });

  it('kicks resumed user-tail debt even after reconciler-inserted continuity notices', () => {
    const entries = [
      message('assistant', 'Question'),
      message('user', 'Answer that still needs assistant continuation'),
      custom('worldUpdate', { specId, currentLsn: 4 }),
      custom('brunch.side_task_result', { id: 'side-1' }),
      custom('brunch.reviewer_drain', { id: 'review-1' }),
    ];

    expect(latestTailOwesAssistant(entries)).toBe(true);
    expect(
      startAssistantTurn({ specId, currentLsn: 4, entries, origin: 'resume_debt', strategy: 'auto' }).action,
    ).toBe('start');
  });

  it('stays idle for request/system leaves and for explicit freestyle while AUTO remains offer-first', () => {
    // Real request_* envelopes carry the outcome as key presence
    // (answered/cancelled/unavailable), never a status string field.
    expect(
      latestTailOwesAssistant([toolResult('request_clarification', { answered: { choices: [] } })]),
    ).toBe(false);
    expect(latestTailOwesAssistant([toolResult('request_clarification', { cancelled: {} })])).toBe(false);
    expect(
      latestTailOwesAssistant([toolResult('request_clarification', { unavailable: { message: 'no UI' } })]),
    ).toBe(false);
    // A status string alone is not a real terminal envelope — still pending.
    expect(latestTailOwesAssistant([toolResult('request_clarification', { status: 'answered' })])).toBe(true);
    expect(latestTailOwesAssistant([toolResult('present_options')])).toBe(false);

    expect(
      startAssistantTurn({
        specId,
        currentLsn: 4,
        entries: [message('assistant', 'Already answered'), custom('worldUpdate', { specId, currentLsn: 4 })],
        origin: 'resume_debt',
        strategy: 'auto',
      }),
    ).toEqual({ action: 'idle', reason: 'no_unresolved_debt', seedEntries: [] });

    expect(
      startAssistantTurn({
        specId,
        currentLsn: 4,
        entries: [message('user', 'Ambient')],
        origin: 'resume_debt',
      }),
    ).toMatchObject({ action: 'start' });

    expect(
      startAssistantTurn({
        specId,
        currentLsn: 4,
        entries: [message('user', 'Ambient')],
        origin: 'resume_debt',
        strategy: 'freestyle',
      }),
    ).toMatchObject({ action: 'idle', reason: 'explicit_freestyle' });
  });

  it('is idempotent across reboot and crash-after-notice-before-provider', () => {
    const seeded = [custom('brunch.context_seed', { specId, snapshotLsn: 9 })];
    expect(
      startAssistantTurn({ specId, currentLsn: 9, entries: seeded, origin: 'new_session' }).seedEntries,
    ).toEqual([]);

    const crashAfterNotice = [
      message('user', 'Please continue'),
      custom('brunch.context_seed', { specId, snapshotLsn: 9 }),
      custom('worldUpdate', { specId, currentLsn: 9 }),
    ];
    expect(
      startAssistantTurn({ specId, currentLsn: 9, entries: crashAfterNotice, origin: 'resume_debt' }),
    ).toMatchObject({ action: 'start', seedEntries: [] });
  });
});
