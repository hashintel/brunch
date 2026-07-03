import { describe, expect, it } from 'vitest';

import { BRUNCH_KICK_CUSTOM_TYPE } from '../../../../session/originate-assistant-turn.js';
import {
  BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
  type SessionOrientationEntryData,
} from '../../../../session/session-orientation.js';
import { SESSION_ORIENTATION_MENU } from '../index.js';
import { runOrientationJuncture, type LiveKickDeps } from '../juncture.js';

interface CapturedEntry {
  readonly type: 'custom' | 'custom_message';
  readonly customType: string;
  readonly data?: unknown;
  readonly content?: string;
}

function fakeSessionManager(seed: readonly CapturedEntry[] = []) {
  const entries: CapturedEntry[] = [...seed];
  return {
    entries,
    appendCustomEntry(customType: string, data: unknown) {
      entries.push({ type: 'custom', customType, data });
      return 'id';
    },
    appendCustomMessageEntry(customType: string, content: string, _display: boolean, _details?: unknown) {
      entries.push({ type: 'custom_message', customType, content });
      return 'id';
    },
    getEntries() {
      return entries as unknown as readonly (CapturedEntry & { type?: unknown })[];
    },
  } as const;
}

function labelFor(id: string): string {
  return SESSION_ORIENTATION_MENU.find((item) => item.id === id)!.label;
}

function fakeUi(response: string | undefined) {
  return { select: async (_title: string, _options: string[]) => response };
}

function fakeKickDeps(overrides: Partial<LiveKickDeps> = {}): {
  deps: LiveKickDeps;
  sent: Array<{ message: unknown; options: unknown }>;
} {
  const sent: Array<{ message: unknown; options: unknown }> = [];
  const deps: LiveKickDeps = {
    specId: 5,
    reads: {
      queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) as never,
    },
    workspaceContext: '',
    modelAvailable: true,
    sendCustomMessage: async (message, options) => {
      sent.push({ message, options });
      return undefined;
    },
    ...overrides,
  };
  return { deps, sent };
}

describe('runOrientationJuncture', () => {
  describe("mode: 'follow-choice'", () => {
    it('no-ops when hasUI is false and does not append an entry (degraded mode)', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: false,
        ui: fakeUi('anything'),
        trigger: 'consult',
        sessionManager: manager,
        mode: 'follow-choice',
        kick: deps,
      });

      expect(result).toEqual({ ran: false, kickFired: false });
      expect(manager.entries).toEqual([]);
      expect(sent).toEqual([]);
    });

    it('appends a continue entry and never fires the kick when the user escapes', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(undefined),
        trigger: 'tree',
        sessionManager: manager,
        mode: 'follow-choice',
        kick: deps,
      });

      expect(result.choice).toBe('continue');
      expect(result.kickFired).toBe(false);
      expect(manager.entries[0]).toEqual({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'continue', trigger: 'tree' } satisfies SessionOrientationEntryData,
      });
      expect(sent).toEqual([]);
    });

    it('appends the entry then fires a live kick on a non-continue choice', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(labelFor('ingest')),
        trigger: 'consult',
        sessionManager: manager,
        mode: 'follow-choice',
        kick: deps,
      });

      expect(result.kickFired).toBe(true);
      expect(sent).toHaveLength(1);
      const kick = sent[0]!.message as { customType: string };
      expect(kick.customType).toBe(BRUNCH_KICK_CUSTOM_TYPE);
      expect(sent[0]!.options).toEqual({ triggerTurn: true });

      // A forced seed was appended (LSN did not advance yet the seed still lands).
      const seedEntry = manager.entries.find((entry) => entry.customType === 'brunch.context_seed');
      expect(seedEntry).toBeDefined();
      expect(String(seedEntry?.content)).toContain('chosen: ingest');
    });

    it('skips the kick when the choice is continue', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(labelFor('continue')),
        trigger: 'abort',
        sessionManager: manager,
        mode: 'follow-choice',
        kick: deps,
      });

      expect(result.choice).toBe('continue');
      expect(result.kickFired).toBe(false);
      expect(sent).toEqual([]);
    });
  });

  describe("mode: 'boot' (option-2 J1)", () => {
    it('degraded mode (no UI) still fires the boot kick without a dialog', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: false,
        ui: fakeUi('anything'),
        trigger: 'entry',
        sessionManager: manager,
        mode: 'boot',
        kick: deps,
      });

      expect(result.ran).toBe(false);
      expect(result.kickFired).toBe(true);
      // No orientation entry (dialog was skipped) but a boot kick still went out.
      expect(
        manager.entries.find((e) => e.customType === BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE),
      ).toBeUndefined();
      expect(sent).toHaveLength(1);
      // Continue-shaped seed only, no orientation directive.
      const seedEntry = manager.entries.find((entry) => entry.customType === 'brunch.context_seed');
      if (seedEntry) expect(String(seedEntry.content)).not.toContain('chosen:');
    });

    it('escape (continue) still fires the boot kick but does not force-seed', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(undefined),
        trigger: 'entry',
        sessionManager: manager,
        mode: 'boot',
        kick: deps,
      });

      expect(result.choice).toBe('continue');
      expect(result.kickFired).toBe(true);
      expect(sent).toHaveLength(1);
    });

    it('non-continue choice at boot fires kick with a forced seed carrying the directive', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(labelFor('propose_intent')),
        trigger: 'entry',
        sessionManager: manager,
        mode: 'boot',
        kick: deps,
      });

      expect(result.choice).toBe('propose_intent');
      expect(result.kickFired).toBe(true);
      expect(sent).toHaveLength(1);
      const seedEntry = manager.entries.find((entry) => entry.customType === 'brunch.context_seed');
      expect(seedEntry).toBeDefined();
      expect(String(seedEntry?.content)).toContain('chosen: propose_intent');
    });
  });
});
