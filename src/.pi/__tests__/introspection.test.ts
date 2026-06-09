import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../brunch-pi-extensions.js';
import {
  BRUNCH_INTROSPECTION_COMMAND,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchIntrospection,
} from '../extensions/introspection/index.js';
import { BRUNCH_SESSION_QUERY_TOOL } from '../extensions/session-query/index.js';

interface FakeCommandContext {
  readonly ui: { notify(message: string, type?: 'info' | 'warning' | 'error'): void };
  getSystemPromptOptions(): unknown;
}

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

  it('is absent by default and registered last when dev introspection is enabled', async () => {
    const productApi = createFakeExtensionApi();

    await createBrunchPiExtensions(brunchChromeFixture, undefined, { coordinator: {} as never })(
      productApi.api as never,
    );

    expect(productApi.commandNames).not.toContain(BRUNCH_INTROSPECTION_COMMAND);
    expect(productApi.toolNames).not.toContain(BRUNCH_SESSION_QUERY_TOOL);
    expect(productApi.eventNames).not.toContain('before_provider_request');

    const devApi = createFakeExtensionApi();
    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      introspection: { enabled: true, store: createInMemoryBrunchIntrospectionStore() },
    })(devApi.api as never);

    expect(devApi.commandNames.at(-1)).toBe(BRUNCH_INTROSPECTION_COMMAND);
    expect(devApi.toolNames.at(-1)).toBe(BRUNCH_SESSION_QUERY_TOOL);
    expect(devApi.eventNames.slice(-2)).toEqual(['before_agent_start', 'before_provider_request']);
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
    getAllTools: () => ['read', 'grep', 'find', 'ls', 'bash'].map((name) => ({ name })),
    setActiveTools() {},
  };

  return {
    api,
    eventNames,
    commandNames,
    toolNames,
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
