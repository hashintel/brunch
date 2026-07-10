import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
  SessionTreeEvent,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { BRUNCH_KICK_CUSTOM_TYPE } from '../../../../session/originate-assistant-turn.js';
import { BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE } from '../../../../session/runtime-state.js';
import { BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE } from '../../../../session/session-orientation.js';
import { CODE_SESSION_ORIENTATION_MENU, SESSION_ORIENTATION_MENU } from '../index.js';
import type { JunctureContextKick } from '../juncture.js';
import {
  BRUNCH_CONSULT_COMMAND,
  orientationJunctureGate,
  registerBrunchSessionOrientation,
} from '../registrar.js';

interface CapturedEntry {
  readonly type: 'custom' | 'custom_message';
  readonly customType: string;
  readonly data?: unknown;
  readonly content?: string;
}

function labelFor(id: string): string {
  return SESSION_ORIENTATION_MENU.items.find((item) => item.id === id)!.label;
}

function codeLabelFor(id: string): string {
  return CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === id)!.label;
}

function executeModeEntry(): CapturedEntry {
  return {
    type: 'custom',
    customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
    data: {
      schemaVersion: 1,
      reason: 'switch',
      source: 'user',
      state: { schemaVersion: 1, operationalMode: 'execute' },
    },
  };
}

interface Handlers {
  session_start?: (event: SessionStartEvent, ctx: ExtensionContext) => Promise<void>;
  session_tree?: (event: SessionTreeEvent, ctx: ExtensionContext) => Promise<void>;
  agent_end?: (event: AgentEndEvent, ctx: ExtensionContext) => Promise<void>;
  consult?: (args: string, ctx: ExtensionContext) => Promise<void>;
}

function collectPi(): { pi: ExtensionAPI; handlers: Handlers } {
  const handlers: Handlers = {};
  const pi = {
    on(event: string, handler: unknown) {
      if (event === 'session_start') handlers.session_start = handler as never;
      else if (event === 'session_tree') handlers.session_tree = handler as never;
      else if (event === 'agent_end') handlers.agent_end = handler as never;
    },
    registerCommand(
      name: string,
      options: { handler: (args: string, ctx: ExtensionContext) => Promise<void> },
    ) {
      if (name === BRUNCH_CONSULT_COMMAND) handlers.consult = options.handler;
    },
  } as unknown as ExtensionAPI;
  return { pi, handlers };
}

function buildCtx(
  response: string | undefined,
  seed: readonly CapturedEntry[] = [],
  options: { readonly availableModels?: readonly unknown[] } = {},
) {
  const entries: CapturedEntry[] = [...seed];
  const notifications: Array<{ readonly message: string; readonly type: unknown }> = [];
  let selectCount = 0;
  const selectOptions: string[][] = [];
  const sessionManager = {
    appendCustomEntry(customType: string, data: unknown) {
      entries.push({ type: 'custom', customType, data });
      return 'id';
    },
    appendCustomMessageEntry(customType: string, content: string) {
      entries.push({ type: 'custom_message', customType, content });
      return 'id';
    },
    getEntries() {
      return entries;
    },
  };
  const ctx = {
    hasUI: true,
    ui: {
      select: async (_title: string, _options: string[]) => {
        selectCount += 1;
        selectOptions.push(_options);
        return response;
      },
      notify: (message: string, type?: unknown) => notifications.push({ message, type }),
    },
    sessionManager: sessionManager as unknown,
    modelRegistry: { getAvailable: () => options.availableModels ?? [{}] } as unknown,
  } as unknown as ExtensionContext;
  return { ctx, entries, notifications, getSelectCount: () => selectCount, selectOptions };
}

type SentMessage = { message: unknown; options: unknown };

function fakeKickContext(sent: SentMessage[]): JunctureContextKick {
  return {
    specId: 3,
    reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) as never },
    workspaceContext: '',
    sendCustomMessage: async (message, options) => {
      sent.push({ message, options });
      return undefined;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function expectSeedThenKick(sent: readonly SentMessage[]) {
  expect(sent).toHaveLength(2);
  expect((sent[0]!.message as { customType?: string }).customType).toBe('brunch.context_seed');
  expect(sent[0]!.options).toBeUndefined();
  expect((sent[1]!.message as { customType?: string }).customType).toBe(BRUNCH_KICK_CUSTOM_TYPE);
  expect(sent[1]!.options).toEqual({ triggerTurn: true });
}

describe('registerBrunchSessionOrientation', () => {
  it.each(['reload', 'fork'] as const)(
    'skips the dialog on session_start reason %s (J7/J8 guard)',
    async (reason) => {
      const { pi, handlers } = collectPi();
      registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
      const { ctx, entries } = buildCtx(labelFor('ingest'));

      await handlers.session_start!({ type: 'session_start', reason }, ctx);

      expect(entries).toEqual([]);
    },
  );

  it('suppresses J1 and shows login guidance when no allowlisted model is currently available', async () => {
    const { pi, handlers } = collectPi();
    const sent: SentMessage[] = [];
    registerBrunchSessionOrientation(pi, {
      resolveKickContext: () => fakeKickContext(sent),
      noAuthNotice: 'No Brunch model auth: Run brunch login, or use /login in this session.',
    });
    const { ctx, entries, notifications, getSelectCount } = buildCtx(labelFor('ingest'), [], {
      availableModels: [],
    });

    await handlers.session_start!({ type: 'session_start', reason: 'startup' }, ctx);

    expect(entries).toEqual([]);
    expect(sent).toEqual([]);
    expect(getSelectCount()).toBe(0);
    expect(notifications).toEqual([
      {
        type: 'warning',
        message: expect.stringContaining('brunch login'),
      },
    ]);
    expect(notifications[0]!.message).toContain('/login');
  });

  it('live-reads model availability so auth added mid-session re-enables the next juncture', async () => {
    const { pi, handlers } = collectPi();
    let availableModels: readonly unknown[] = [];
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
    const { ctx, entries, getSelectCount } = buildCtx(labelFor('ingest'), [], {
      get availableModels() {
        return availableModels;
      },
    });

    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'a', oldLeafId: 'b' }, ctx);
    availableModels = [{}];
    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'c', oldLeafId: 'd' }, ctx);

    expect(getSelectCount()).toBe(1);
    expect(entries.at(-1)).toEqual({
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'ingest', trigger: 'tree' },
    });
  });

  it('suppresses event junctures without dialog, entry, or kick when no allowlisted model is currently available', async () => {
    const { pi, handlers } = collectPi();
    const sent: SentMessage[] = [];
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => fakeKickContext(sent) });
    const { ctx, entries, notifications, getSelectCount } = buildCtx(labelFor('ingest'), [], {
      availableModels: [],
    });

    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'a', oldLeafId: 'b' }, ctx);

    expect(entries).toEqual([]);
    expect(sent).toEqual([]);
    expect(getSelectCount()).toBe(0);
    expect(notifications).toEqual([]);
  });

  it('runs the dialog on session_start reason startup with trigger entry (J1 boot) and fires a boot kick', async () => {
    const { pi, handlers } = collectPi();
    const sent: SentMessage[] = [];
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => fakeKickContext(sent) });
    const { ctx, entries } = buildCtx(labelFor('ingest'));

    await handlers.session_start!({ type: 'session_start', reason: 'startup' }, ctx);

    expect(
      entries.find((entry) => entry.customType === BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE)?.data,
    ).toEqual({ schemaVersion: 1, choice: 'ingest', trigger: 'entry' });
    // Boot sends the live seed, then fires the kick (mode 'boot' always originates+kicks).
    expectSeedThenKick(sent);
  });

  it.each(['new', 'resume'] as const)(
    'runs the dialog on session_start reason %s with trigger switch',
    async (reason) => {
      const { pi, handlers } = collectPi();
      registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
      const { ctx, entries } = buildCtx(labelFor('ingest'));

      await handlers.session_start!({ type: 'session_start', reason }, ctx);

      expect(entries.at(-1)).toEqual({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'ingest', trigger: 'switch' },
      });
    },
  );

  it('derives the J2 post-switch menu from Execute runtime state', async () => {
    const { pi, handlers } = collectPi();
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
    const { ctx, entries, selectOptions } = buildCtx(codeLabelFor('execute_plan'), [executeModeEntry()]);

    await handlers.session_start!({ type: 'session_start', reason: 'resume' }, ctx);

    expect(selectOptions.at(-1)).toEqual(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.label));
    expect(entries.at(-1)).toEqual({
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'execute_plan', trigger: 'switch' },
    });
  });

  it('runs the dialog on session_tree with trigger tree', async () => {
    const { pi, handlers } = collectPi();
    const sent: SentMessage[] = [];
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => fakeKickContext(sent) });
    const { ctx, entries } = buildCtx(labelFor('ingest'));

    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'a', oldLeafId: 'b' }, ctx);

    expect(
      entries.find((entry) => entry.customType === BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE)?.data,
    ).toEqual({
      schemaVersion: 1,
      choice: 'ingest',
      trigger: 'tree',
    });
    expectSeedThenKick(sent);
  });

  it('derives the J3 tree menu from Execute runtime state', async () => {
    const { pi, handlers } = collectPi();
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
    const { ctx, entries, selectOptions } = buildCtx(codeLabelFor('compile_plan'), [executeModeEntry()]);

    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'a', oldLeafId: 'b' }, ctx);

    expect(selectOptions.at(-1)).toEqual(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.label));
    expect(entries.at(-1)).toEqual({
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'compile_plan', trigger: 'tree' },
    });
  });

  it('fires on agent_end only when the tail assistant message stopReason is aborted (C3 probe)', async () => {
    const { pi, handlers } = collectPi();
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
    const { ctx: notAbortedCtx, entries: notAborted } = buildCtx(labelFor('ingest'));

    await handlers.agent_end!(
      {
        type: 'agent_end',
        messages: [
          {
            role: 'assistant',
            content: [],
            stopReason: 'stop',
            usage: { input: 0, output: 0 },
            timestamp: 0,
          } as never,
        ],
      },
      notAbortedCtx,
    );
    expect(notAborted).toEqual([]);

    const { ctx: abortedCtx, entries: aborted } = buildCtx(labelFor('elicit_examples'));
    await handlers.agent_end!(
      {
        type: 'agent_end',
        messages: [
          {
            role: 'user',
            content: 'hi',
          } as never,
          {
            role: 'assistant',
            content: [],
            stopReason: 'aborted',
            usage: { input: 0, output: 0 },
            timestamp: 0,
          } as never,
        ],
      },
      abortedCtx,
    );
    expect(aborted.at(-1)).toEqual({
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'elicit_examples', trigger: 'abort' },
    });
  });

  it('derives the J4 abort menu from Execute runtime state', async () => {
    const { pi, handlers } = collectPi();
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });
    const { ctx, entries, selectOptions } = buildCtx(codeLabelFor('prepare_execution'), [executeModeEntry()]);

    await handlers.agent_end!(
      {
        type: 'agent_end',
        messages: [
          {
            role: 'assistant',
            content: [],
            stopReason: 'aborted',
            usage: { input: 0, output: 0 },
            timestamp: 0,
          } as never,
        ],
      },
      ctx,
    );

    expect(selectOptions.at(-1)).toEqual(CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.label));
    expect(entries.at(-1)).toEqual({
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'prepare_execution', trigger: 'abort' },
    });
  });

  it('skips J4 exactly once when a product flow claimed the abort via the shared gate', async () => {
    const { pi, handlers } = collectPi();
    const deps = { resolveKickContext: () => undefined };
    registerBrunchSessionOrientation(pi, deps);
    orientationJunctureGate(deps).suppressNextAbortJuncture = true;

    const abortedEvent = {
      type: 'agent_end' as const,
      messages: [
        {
          role: 'assistant',
          content: [],
          stopReason: 'aborted',
          usage: { input: 0, output: 0 },
          timestamp: 0,
        } as never,
      ],
    };

    const { ctx: suppressedCtx, entries: suppressed } = buildCtx(labelFor('ingest'));
    await handlers.agent_end!(abortedEvent, suppressedCtx);
    expect(suppressed).toEqual([]);
    expect(orientationJunctureGate(deps).suppressNextAbortJuncture).toBe(false);

    // The claim is one-shot: a later real esc-abort runs the dialog again.
    const { ctx: laterCtx, entries: later } = buildCtx(labelFor('ingest'));
    await handlers.agent_end!(abortedEvent, laterCtx);
    expect(later.at(-1)).toEqual({
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'ingest', trigger: 'abort' },
    });
  });

  it('claims the gate before awaits so near-simultaneous event junctures cannot both run', async () => {
    const { pi, handlers } = collectPi();
    const kickContext = deferred<JunctureContextKick | undefined>();
    const deps = { resolveKickContext: () => kickContext.promise };
    registerBrunchSessionOrientation(pi, deps);

    const { ctx: firstCtx, entries: firstEntries } = buildCtx(labelFor('ingest'));
    const first = handlers.session_tree!({ type: 'session_tree', newLeafId: 'a', oldLeafId: 'b' }, firstCtx);

    const { ctx: secondCtx, entries: secondEntries } = buildCtx(labelFor('ingest'));
    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'c', oldLeafId: 'd' }, secondCtx);

    expect(firstEntries).toEqual([]);
    expect(secondEntries).toEqual([]);

    kickContext.resolve(undefined);
    await first;

    expect(firstEntries).toHaveLength(1);
    expect(secondEntries).toEqual([]);
  });

  it('updates the guard when degraded boot fires a kick without a dialog', async () => {
    const { pi, handlers } = collectPi();
    const sent: SentMessage[] = [];
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => fakeKickContext(sent) });
    const { ctx } = buildCtx(undefined);
    const noUiCtx = { ...ctx, hasUI: false } as ExtensionContext;

    await handlers.session_start!({ type: 'session_start', reason: 'startup' }, noUiCtx);
    await handlers.session_start!({ type: 'session_start', reason: 'startup' }, noUiCtx);

    expect(sent).toHaveLength(2);
  });

  it('debounces coinciding junctures within the debounce window', async () => {
    const { pi, handlers } = collectPi();
    registerBrunchSessionOrientation(pi, { resolveKickContext: () => undefined });

    const { ctx: firstCtx, entries } = buildCtx(labelFor('ingest'));
    await handlers.session_tree!({ type: 'session_tree', newLeafId: 'a', oldLeafId: 'b' }, firstCtx);

    // Second juncture uses a fresh manager sharing the same debounce state
    // via the closure captured at registration time.
    const { ctx: secondCtx, entries: secondEntries } = buildCtx(labelFor('ingest'));
    await handlers.agent_end!(
      {
        type: 'agent_end',
        messages: [
          { role: 'assistant', content: [], stopReason: 'aborted', usage: {}, timestamp: 0 } as never,
        ],
      },
      secondCtx,
    );

    expect(entries).toHaveLength(1);
    expect(secondEntries).toEqual([]);
  });
});
