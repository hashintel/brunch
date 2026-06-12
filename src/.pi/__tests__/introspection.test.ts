import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../brunch-pi-extensions.js';
import { BRUNCH_INTROSPECT_QUERY_TOOL } from '../extensions/introspect-query/index.js';
import {
  appendEntryContentToDebugCache,
  BRUNCH_INTROSPECTION_COMMAND,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchIntrospection,
} from '../extensions/introspection/index.js';
import { BRUNCH_SESSION_QUERY_TOOL } from '../extensions/session-query/index.js';

interface FakeCommandContext {
  readonly ui: { notify(message: string, type?: 'info' | 'warning' | 'error'): void };
  getSystemPromptOptions(): unknown;
}

describe('debug cache entry-contents mirror (origination-kick-live card 2)', () => {
  it('mirrors a message-carrier continuity entry with content and details', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-entry-mirror-'));
    await appendEntryContentToDebugCache(
      { cwd },
      {
        type: 'custom_message',
        customType: 'brunch.context_seed',
        content: 'Context seeded for spec 1.\nOpen elicitation gaps: …',
        details: { specId: 1, snapshotLsn: 4 },
      },
    );
    const mirror = await readFile(join(cwd, '.brunch/debug/entry-contents.md'), 'utf8');
    expect(mirror).toContain('brunch.context_seed');
    expect(mirror).toContain('custom_message');
    expect(mirror).toContain('Context seeded for spec 1.');
    expect(mirror).toContain('"snapshotLsn": 4');
  });

  it('mirrors a ledger entry with its data payload and appends as separated blocks', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-entry-mirror-'));
    await appendEntryContentToDebugCache(
      { cwd },
      { type: 'custom', customType: 'brunch.own_mutation', data: { specId: 1, lsn: 9 } },
    );
    await appendEntryContentToDebugCache(
      { cwd },
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: 'World update: 2 items.',
        details: { specId: 1, currentLsn: 11 },
      },
    );
    const mirror = await readFile(join(cwd, '.brunch/debug/entry-contents.md'), 'utf8');
    expect(mirror).toContain('brunch.own_mutation');
    expect(mirror).toContain('"lsn": 9');
    expect(mirror).toContain('World update: 2 items.');
    expect(mirror.indexOf('brunch.own_mutation')).toBeLessThan(mirror.indexOf('worldUpdate'));
    expect(mirror).toContain('\n\n---\n\n');
  });
});

describe('Brunch introspection extension', () => {
  it('records provider payloads without replacing them', async () => {
    const api = createFakeExtensionApi();
    const store = createInMemoryBrunchIntrospectionStore();

    registerBrunchIntrospection(api.api as never, { store, clock: fixedClock });

    await api.emitBeforeAgentStart({ systemPrompt: 'base' });
    const result = await api.emitBeforeProviderRequest({ payload: { system: 'final', tools: ['read'] } });

    expect(result).toBeUndefined();
    expect(store.passiveCaptures).toEqual([
      {
        turnId: 'turn-1',
        capturedAt: fixedClock().toISOString(),
        event: 'before_provider_request',
        payload: { system: 'final', tools: ['read'] },
      },
    ]);
  });

  it('reports base prompt inputs plus the latest passive capture through /introspect', async () => {
    const api = createFakeExtensionApi();
    const store = createInMemoryBrunchIntrospectionStore();
    const notifications: string[] = [];

    registerBrunchIntrospection(api.api as never, { store, clock: fixedClock });
    await api.emitBeforeProviderRequest({ payload: { messages: ['final'] } });

    await api.runCommand(BRUNCH_INTROSPECTION_COMMAND, {
      ui: { notify: (message) => notifications.push(message) },
      getSystemPromptOptions: () => ({ cwd: '/tmp/brunch', selectedTools: ['read'] }),
    });

    expect(store.latestBaseReport()).toEqual({
      reportedAt: fixedClock().toISOString(),
      command: BRUNCH_INTROSPECTION_COMMAND,
      baseSystemPromptOptions: { cwd: '/tmp/brunch', selectedTools: ['read'] },
      latestPassiveCapture: store.latestPassiveCapture(),
    });
    expect(notifications[0]).toContain('Brunch introspection report captured.');
  });

  it('captures the post-mutation payload when registered after a provider mutator', async () => {
    const api = createFakeExtensionApi();
    const store = createInMemoryBrunchIntrospectionStore();

    api.api.on('before_provider_request', (event: unknown) => ({ wrapped: providerPayloadFrom(event) }));
    registerBrunchIntrospection(api.api as never, { store, clock: fixedClock });

    const finalPayload = await api.runProviderRequestChain({ payload: { original: true } });

    expect(finalPayload).toEqual({ wrapped: { original: true } });
    expect(store.latestPassiveCapture()?.payload).toEqual({ wrapped: { original: true } });
  });

  it('mirrors the latest captured final system prompt into the workspace debug cache', async () => {
    const api = createFakeExtensionApi();
    const store = createInMemoryBrunchIntrospectionStore();
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-introspection-debug-'));

    registerBrunchIntrospection(api.api as never, {
      store,
      clock: fixedClock,
      debugCache: { cwd },
    });

    await api.emitBeforeProviderRequest({ payload: { system: 'first final prompt' } });
    await api.emitBeforeProviderRequest({ payload: { system: 'second final prompt' } });

    await expect(readFile(join(cwd, '.brunch/debug/system-prompt.md'), 'utf8')).resolves.toBe(
      'second final prompt',
    );
  });

  it('appends only explicit Brunch-owned text tool results to the workspace debug cache', async () => {
    const api = createFakeExtensionApi();
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-introspection-tools-'));

    registerBrunchIntrospection(api.api as never, {
      clock: fixedClock,
      debugCache: { cwd },
    });

    await api.emitToolResult({
      toolName: 'read_graph',
      content: [{ type: 'text', text: 'graph block' }],
    });
    await api.emitToolResult({
      toolName: 'read',
      content: [{ type: 'text', text: 'built-in block' }],
    });
    await api.emitToolResult({
      toolName: 'brunch_session_query',
      content: [{ type: 'text', text: 'query block' }],
    });

    await expect(readFile(join(cwd, '.brunch/debug/tool-contents.md'), 'utf8')).resolves.toBe(
      'graph block\n\n---\n\nquery block',
    );
  });

  it('is absent by default and registered last when dev introspection is enabled', async () => {
    const productApi = createFakeExtensionApi();

    await createBrunchPiExtensions(brunchChromeFixture, undefined, { coordinator: {} as never })(
      productApi.api as never,
    );

    expect(productApi.commandNames).not.toContain(BRUNCH_INTROSPECTION_COMMAND);
    expect(productApi.toolNames).not.toContain(BRUNCH_SESSION_QUERY_TOOL);
    expect(productApi.toolNames).not.toContain(BRUNCH_INTROSPECT_QUERY_TOOL);
    expect(productApi.eventNames).not.toContain('before_provider_request');

    const devApi = createFakeExtensionApi();
    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      introspection: { enabled: true, store: createInMemoryBrunchIntrospectionStore() },
    })(devApi.api as never);

    expect(devApi.commandNames.at(-1)).toBe(BRUNCH_INTROSPECTION_COMMAND);
    expect(devApi.toolNames.slice(-2)).toEqual([BRUNCH_SESSION_QUERY_TOOL, BRUNCH_INTROSPECT_QUERY_TOOL]);
    expect(devApi.eventNames).toEqual(
      expect.arrayContaining(['before_agent_start', 'before_provider_request', 'tool_result']),
    );
  });

  it('advertises registered dev query tools only when introspection is enabled', async () => {
    const productApi = createFakeExtensionApi();
    await createBrunchPiExtensions(brunchChromeFixture, undefined, { coordinator: {} as never })(
      productApi.api as never,
    );
    await productApi.emitBeforeAgentStart({ systemPrompt: 'base' });

    const devApi = createFakeExtensionApi();
    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      introspection: { enabled: true, store: createInMemoryBrunchIntrospectionStore() },
    })(devApi.api as never);
    await devApi.emitBeforeAgentStart({ systemPrompt: 'base' });

    expect(productApi.activeToolSets.at(-1)).not.toContain(BRUNCH_SESSION_QUERY_TOOL);
    expect(productApi.activeToolSets.at(-1)).not.toContain(BRUNCH_INTROSPECT_QUERY_TOOL);
    expect(devApi.activeToolSets.at(-1)).toEqual(
      expect.arrayContaining([BRUNCH_SESSION_QUERY_TOOL, BRUNCH_INTROSPECT_QUERY_TOOL]),
    );
  });
});

function fixedClock(): Date {
  return new Date('2026-06-09T00:00:00.000Z');
}

const brunchChromeFixture = {
  cwd: '/tmp/brunch',
  chatMode: 'responding-to-elicitation' as const,
  phase: 'elicitation' as const,
  spec: { id: 1, title: 'Fixture spec' },
  session: { id: 'session-1', label: 'Fixture session' },
};

function createFakeExtensionApi() {
  const eventNames: string[] = [];
  const commandNames: string[] = [];
  const toolNames: string[] = [];
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => unknown>>();
  const commands = new Map<string, { handler(args: string, ctx: FakeCommandContext): Promise<void> }>();
  const activeToolSets: string[][] = [];
  const api = {
    on(eventName: string, handler: (event: unknown, ctx: unknown) => unknown) {
      eventNames.push(eventName);
      handlers.set(eventName, [...(handlers.get(eventName) ?? []), handler]);
    },
    registerCommand(
      name: string,
      command: { handler(args: string, ctx: FakeCommandContext): Promise<void> },
    ) {
      commandNames.push(name);
      commands.set(name, command);
    },
    registerTool(tool: { name: string }) {
      toolNames.push(tool.name);
    },
    registerShortcut() {},
    registerMessageRenderer() {},
    sendMessage() {},
    getAllTools: () =>
      [...new Set(['read', 'grep', 'find', 'ls', 'bash', ...toolNames])].map((name) => ({ name })),
    setActiveTools(tools: string[]) {
      activeToolSets.push(tools);
    },
  };

  return {
    api,
    eventNames,
    commandNames,
    toolNames,
    activeToolSets,
    async emitBeforeAgentStart(event: unknown): Promise<unknown> {
      return last(
        await Promise.all((handlers.get('before_agent_start') ?? []).map((handler) => handler(event, {}))),
      );
    },
    async emitBeforeProviderRequest(event: unknown): Promise<unknown> {
      return last(
        await Promise.all(
          (handlers.get('before_provider_request') ?? []).map((handler) => handler(event, {})),
        ),
      );
    },
    async emitToolResult(event: unknown): Promise<unknown> {
      return last(
        await Promise.all((handlers.get('tool_result') ?? []).map((handler) => handler(event, {}))),
      );
    },
    async runProviderRequestChain(event: { payload: unknown }): Promise<unknown> {
      let currentPayload = event.payload;
      for (const handler of handlers.get('before_provider_request') ?? []) {
        const replacement = await handler({ payload: currentPayload }, {});
        if (replacement !== undefined) currentPayload = replacement;
      }
      return currentPayload;
    },
    async runCommand(name: string, ctx: FakeCommandContext): Promise<void> {
      const command = commands.get(name);
      if (!command) throw new Error(`Command not registered: ${name}`);
      await command.handler('', ctx);
    },
  };
}

function last(values: readonly unknown[]): unknown {
  return values.at(-1);
}

function providerPayloadFrom(event: unknown): unknown {
  return typeof event === 'object' && event !== null && 'payload' in event ? event.payload : undefined;
}
