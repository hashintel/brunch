import { describe, expect, it } from 'vitest';

import { runOrientationJuncture, type LiveKickDeps } from '../juncture.js';

function harness(response: string | undefined, failAppend = false) {
  const events: string[] = [];
  const entries: Array<{ type: string; customType: string; data?: unknown }> = [];
  const manager = {
    appendCustomEntry(customType: string, data: unknown) {
      if (failAppend) throw new Error('append failed');
      events.push(`append:${customType}`);
      entries.push({ type: 'custom', customType, data });
    },
    appendCustomMessageEntry() {},
    getBranch: () => entries,
  };
  const kick: LiveKickDeps = {
    specId: 1,
    reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) as never },
    workspaceContext: '',
    modelAvailable: true,
    sendCustomMessage: async (message, options) => {
      events.push(options?.triggerTurn ? 'kick' : `seed:${message.customType}`);
    },
  };
  return { events, manager, kick, ui: { select: async () => response } };
}

describe('orientation juncture', () => {
  it('appends a changed style before seed and kick', async () => {
    const h = harness('Work via examples');
    await runOrientationJuncture({
      hasUI: true,
      ui: h.ui,
      trigger: 'consult',
      sessionManager: h.manager as never,
      kick: h.kick,
    });
    expect(h.events).toEqual(['append:brunch.elicitation_style', 'seed:brunch.context_seed', 'kick']);
  });

  it('same style kicks without duplicate style history', async () => {
    const h = harness('Work via intent');
    h.manager.appendCustomEntry('brunch.elicitation_style', { schemaVersion: 1, style: 'interrogate' });
    h.events.length = 0;
    await runOrientationJuncture({
      hasUI: true,
      ui: h.ui,
      trigger: 'consult',
      sessionManager: h.manager as never,
      kick: h.kick,
    });
    expect(h.events).toEqual(['seed:brunch.context_seed', 'kick']);
  });

  it.each([undefined, 'unknown'])(
    'dismissal/unavailable selection starts no write, seed, or kick',
    async (response) => {
      const h = harness(response);
      await runOrientationJuncture({
        hasUI: true,
        ui: h.ui,
        trigger: 'consult',
        sessionManager: h.manager as never,
        kick: h.kick,
      });
      expect(h.events).toEqual([]);
    },
  );

  it('append failure starts no seed or kick', async () => {
    const h = harness('Work via proposals', true);
    await runOrientationJuncture({
      hasUI: true,
      ui: h.ui,
      trigger: 'consult',
      sessionManager: h.manager as never,
      kick: h.kick,
    });
    expect(h.events).toEqual([]);
  });
});
