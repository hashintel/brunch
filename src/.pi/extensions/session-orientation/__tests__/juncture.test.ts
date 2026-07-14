import { describe, expect, it } from 'vitest';

import {
  BRUNCH_KICK_CUSTOM_TYPE,
  type KickCompletionOutcome,
} from '../../../../session/originate-assistant-turn.js';
import {
  BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
  type SessionOrientationEntryData,
} from '../../../../session/session-orientation.js';
import { CODE_SESSION_ORIENTATION_MENU, SESSION_ORIENTATION_MENU } from '../index.js';
import {
  ORIENTATION_RPC_DIALOG_TIMEOUT_MS,
  adaptOrientationUi,
  runJunctureForContext,
  runOrientationJuncture,
  type LiveKickDeps,
} from '../juncture.js';

interface CapturedEntry {
  readonly type: 'custom' | 'custom_message' | 'message';
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
  return SESSION_ORIENTATION_MENU.items.find((item) => item.id === id)!.label;
}

function codeLabelFor(id: string): string {
  return CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === id)!.label;
}

function fakeUi(response: string | undefined) {
  return { select: async (_title: string, _options: string[]) => response };
}

type SentMessage = { message: unknown; options: unknown };

function fakeKickDeps(overrides: Partial<LiveKickDeps> = {}): {
  deps: LiveKickDeps;
  sent: SentMessage[];
  outcomes: Array<{ outcome: KickCompletionOutcome; decision: unknown }>;
} {
  const sent: SentMessage[] = [];
  const outcomes: Array<{ outcome: KickCompletionOutcome; decision: unknown }> = [];
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
    onKickOutcome: (outcome, decision) => {
      outcomes.push({ outcome, decision });
    },
    ...overrides,
  };
  return { deps, sent, outcomes };
}

function expectSeedThenKick(sent: readonly SentMessage[]) {
  expect(sent).toHaveLength(2);
  const seed = sent[0]!.message as { customType: string; content?: string };
  expect(seed.customType).toBe('brunch.context_seed');
  expect(sent[0]!.options).toBeUndefined();
  const kick = sent[1]!.message as { customType: string };
  expect(kick.customType).toBe(BRUNCH_KICK_CUSTOM_TYPE);
  expect(sent[1]!.options).toEqual({ triggerTurn: true });
  return { seed, kick };
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

    it('appends a dismissed entry and never fires the kick when the user escapes', async () => {
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

      expect(result.choice).toBe('dismissed');
      expect(result.kickFired).toBe(false);
      expect(manager.entries[0]).toEqual({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: {
          schemaVersion: 1,
          choice: 'dismissed',
          trigger: 'tree',
        } satisfies SessionOrientationEntryData,
      });
      expect(sent).toEqual([]);
    });

    it('does not fire a directed kick when the orientation entry append fails', async () => {
      const manager = {
        ...fakeSessionManager(),
        appendCustomEntry() {
          throw new Error('ledger write failed');
        },
      };
      const { deps, sent } = fakeKickDeps();
      const errors: unknown[] = [];

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(labelFor('ingest')),
        trigger: 'consult',
        sessionManager: manager,
        mode: 'follow-choice',
        kick: deps,
        onAppendError: (error) => errors.push(error),
      });

      expect(result).toEqual({ ran: true, choice: 'ingest', kickFired: false });
      expect(errors).toHaveLength(1);
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
      const { seed } = expectSeedThenKick(sent);

      // A forced seed was delivered live (LSN did not advance yet the seed still lands).
      expect(String(seed.content)).toContain('chosen: ingest');
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

  describe("mode: 'follow-choice' with CODE menu (J5 CODE)", () => {
    it('skips the dialog, entry, and kick when UI is unavailable', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: false,
        ui: fakeUi(codeLabelFor('prepare_execution')),
        trigger: 'mode-switch',
        sessionManager: manager,
        mode: 'follow-choice',
        menu: CODE_SESSION_ORIENTATION_MENU,
        kick: deps,
      });

      expect(result).toEqual({ ran: false, kickFired: false });
      expect(manager.entries).toEqual([]);
      expect(sent).toEqual([]);
    });

    it('maps escape to an inert dismissed entry and never kicks (esc means wait)', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(undefined),
        trigger: 'mode-switch',
        sessionManager: manager,
        mode: 'follow-choice',
        menu: CODE_SESSION_ORIENTATION_MENU,
        kick: deps,
      });

      expect(result).toEqual({ ran: true, choice: 'dismissed', kickFired: false });
      expect(manager.entries[0]).toEqual({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'dismissed', trigger: 'mode-switch' },
      });
      expect(sent).toEqual([]);
    });

    it('does not fire a CODE directed kick when the orientation entry append fails', async () => {
      const manager = {
        ...fakeSessionManager(),
        appendCustomEntry() {
          throw new Error('ledger write failed');
        },
      };
      const { deps, sent } = fakeKickDeps();
      const errors: unknown[] = [];

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(codeLabelFor('prepare_execution')),
        trigger: 'mode-switch',
        sessionManager: manager,
        mode: 'follow-choice',
        menu: CODE_SESSION_ORIENTATION_MENU,
        kick: deps,
        onAppendError: (error) => errors.push(error),
      });

      expect(result).toEqual({ ran: true, choice: 'prepare_execution', kickFired: false });
      expect(errors).toHaveLength(1);
      expect(sent).toEqual([]);
    });

    it('propagates honest completion outcomes and derives kickFired only from fired CODE kicks', async () => {
      const cases: Array<{
        name: string;
        deps: Partial<LiveKickDeps>;
        expectedResult: boolean;
        expectedOutcome: KickCompletionOutcome;
      }> = [
        {
          name: 'fired',
          deps: {},
          expectedResult: true,
          expectedOutcome: { status: 'fired', origin: 'new_session' },
        },
        {
          name: 'no model',
          deps: { modelAvailable: false },
          expectedResult: false,
          expectedOutcome: { status: 'skipped', reason: 'no_model_available' },
        },
        {
          name: 'failed send',
          deps: {
            sendCustomMessage: async (message, options) => {
              if (message.customType === BRUNCH_KICK_CUSTOM_TYPE) throw new Error('provider queue failed');
              return fakeKickDeps().deps.sendCustomMessage(message, options);
            },
          },
          expectedResult: false,
          expectedOutcome: {
            status: 'failed',
            origin: 'new_session',
            error: expect.objectContaining({ message: 'provider queue failed' }) as never,
          },
        },
      ];

      for (const testCase of cases) {
        const manager = fakeSessionManager();
        const { deps, outcomes } = fakeKickDeps(testCase.deps);

        const result = await runOrientationJuncture({
          hasUI: true,
          ui: fakeUi(codeLabelFor('prepare_execution')),
          trigger: 'mode-switch',
          sessionManager: manager,
          mode: 'follow-choice',
          menu: CODE_SESSION_ORIENTATION_MENU,
          kick: deps,
        });

        expect(result, testCase.name).toMatchObject({
          ran: true,
          choice: 'prepare_execution',
          kickFired: testCase.expectedResult,
        });
        expect(
          outcomes.map(({ outcome }) => outcome),
          testCase.name,
        ).toEqual([testCase.expectedOutcome]);
      }
    });

    it('reports idle boot completion honestly when origination has no unresolved debt', async () => {
      const manager = fakeSessionManager([
        { type: 'message', customType: 'message', content: 'assistant already answered' },
        { type: 'custom_message', customType: BRUNCH_KICK_CUSTOM_TYPE, content: 'prior kick' },
      ]);
      const { deps, outcomes, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(labelFor('continue')),
        trigger: 'entry',
        sessionManager: manager,
        mode: 'boot',
        kick: deps,
      });

      expect(result).toMatchObject({ ran: true, choice: 'continue', kickFired: false });
      expect(outcomes.map(({ outcome }) => outcome)).toEqual([
        { status: 'skipped', reason: 'idle_no_unresolved_debt' },
      ]);
      expect(sent).toEqual([]);
    });

    it('fires a forced manual kick for every CODE endpoint with the matching directive', async () => {
      for (const choice of CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.id)) {
        const manager = fakeSessionManager();
        const { deps, sent } = fakeKickDeps();

        const result = await runOrientationJuncture({
          hasUI: true,
          ui: fakeUi(codeLabelFor(choice)),
          trigger: 'mode-switch',
          sessionManager: manager,
          mode: 'follow-choice',
          menu: CODE_SESSION_ORIENTATION_MENU,
          kick: deps,
        });

        expect(result).toMatchObject({ ran: true, choice, kickFired: true });
        const { seed } = expectSeedThenKick(sent);
        expect(String(seed.content)).toContain(`chosen: ${choice}`);
      }
    });
  });

  describe('adaptOrientationUi (C1 RPC dialog timeout)', () => {
    it('passes through select args untouched when mode is not rpc', async () => {
      const calls: Array<[string, string[], unknown]> = [];
      const ctx = {
        mode: 'tui' as const,
        ui: {
          select: async (title: string, options: string[], opts?: unknown) => {
            calls.push([title, options, opts]);
            return options[0];
          },
        },
      };
      const dialogUi = adaptOrientationUi(ctx);
      await dialogUi.select('pick', ['a', 'b']);
      expect(calls).toEqual([['pick', ['a', 'b'], undefined]]);
    });

    it('applies the RPC dialog timeout when mode is rpc so a mute client cannot block orientation forever', async () => {
      const calls: Array<[string, string[], unknown]> = [];
      const ctx = {
        mode: 'rpc' as const,
        ui: {
          select: async (title: string, options: string[], opts?: unknown) => {
            calls.push([title, options, opts]);
            return undefined;
          },
        },
      };
      const dialogUi = adaptOrientationUi(ctx);
      const chosen = await dialogUi.select('pick', ['a', 'b']);
      expect(chosen).toBeUndefined();
      expect(calls).toHaveLength(1);
      expect(calls[0]![2]).toEqual({ timeout: ORIENTATION_RPC_DIALOG_TIMEOUT_MS });
    });
  });

  describe('runJunctureForContext (J5 shared entry point)', () => {
    it('reports and degrades to no-op when the extension context lacks a mutable session manager', async () => {
      const { deps, sent } = fakeKickDeps();
      const errors: unknown[] = [];
      const result = await runJunctureForContext({
        ctx: {
          mode: 'tui',
          hasUI: true,
          ui: { select: async () => 'anything' },
          modelRegistry: { getAvailable: () => [{ id: 'm' } as never] },
          sessionManager: {},
        },
        trigger: 'mode-switch',
        mode: 'follow-choice',
        kick: {
          specId: deps.specId,
          reads: deps.reads,
          workspaceContext: deps.workspaceContext,
          sendCustomMessage: deps.sendCustomMessage,
        },
        onAppendError: (error) => {
          errors.push(error);
        },
      });
      expect(result).toEqual({ ran: false, kickFired: false });
      expect(errors).toHaveLength(1);
      expect(sent).toEqual([]);
    });

    it('suppresses the dialog and kick when no provider auth resolves', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();
      let selected = false;

      const result = await runJunctureForContext({
        ctx: {
          mode: 'tui',
          hasUI: true,
          ui: {
            select: async () => {
              selected = true;
              return labelFor('ingest');
            },
          },
          modelRegistry: { getAvailable: () => [] },
          sessionManager: manager,
        },
        trigger: 'mode-switch',
        mode: 'follow-choice',
        kick: {
          specId: deps.specId,
          reads: deps.reads,
          workspaceContext: deps.workspaceContext,
          sendCustomMessage: deps.sendCustomMessage,
        },
        onAppendError: () => {},
      });

      expect(result).toEqual({ ran: false, kickFired: false });
      expect(selected).toBe(false);
      expect(manager.entries).toEqual([]);
      expect(sent).toEqual([]);
    });

    it('delegates to runOrientationJuncture with the timeout-adapted RPC UI (J5 mode-switch path)', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();
      const selectCalls: Array<{ opts: unknown }> = [];
      const result = await runJunctureForContext({
        ctx: {
          mode: 'rpc',
          hasUI: true,
          ui: {
            select: async (_title: string, options: string[], opts?: unknown) => {
              selectCalls.push({ opts });
              return options.find((label) => label === labelFor('ingest'));
            },
          },
          modelRegistry: { getAvailable: () => [{ id: 'm' } as never] },
          sessionManager: manager,
        },
        trigger: 'mode-switch',
        mode: 'follow-choice',
        kick: {
          specId: deps.specId,
          reads: deps.reads,
          workspaceContext: deps.workspaceContext,
          sendCustomMessage: deps.sendCustomMessage,
        },
        onAppendError: () => {},
      });
      expect(result.kickFired).toBe(true);
      expect(selectCalls).toHaveLength(1);
      expect(selectCalls[0]!.opts).toEqual({ timeout: ORIENTATION_RPC_DIALOG_TIMEOUT_MS });
      expectSeedThenKick(sent);
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
      const { seed } = expectSeedThenKick(sent);
      // Continue-shaped seed only, no orientation directive.
      expect(String(seed.content)).not.toContain('chosen:');
    });

    it('escape at boot records a dismissed entry and suppresses the boot kick (inert wait)', async () => {
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

      expect(result.choice).toBe('dismissed');
      expect(result.kickFired).toBe(false);
      expect(manager.entries[0]).toEqual({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'dismissed', trigger: 'entry' },
      });
      expect(sent).toEqual([]);
    });

    it('an explicit continue at boot still fires the boot kick but does not force-seed', async () => {
      const manager = fakeSessionManager();
      const { deps, sent } = fakeKickDeps();

      const result = await runOrientationJuncture({
        hasUI: true,
        ui: fakeUi(labelFor('continue')),
        trigger: 'entry',
        sessionManager: manager,
        mode: 'boot',
        kick: deps,
      });

      expect(result.choice).toBe('continue');
      expect(result.kickFired).toBe(true);
      expectSeedThenKick(sent);
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
      const { seed } = expectSeedThenKick(sent);
      expect(String(seed.content)).toContain('chosen: propose_intent');
    });
  });
});
