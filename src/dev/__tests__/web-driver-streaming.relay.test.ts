import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fauxAssistantMessage,
  registerFauxProvider,
  type Context,
  type FauxProviderRegistration,
} from '@earendil-works/pi-ai';
import {
  AuthStorage,
  createAgentSessionRuntime,
  ModelRegistry,
  type AgentSessionEvent,
} from '@earendil-works/pi-coding-agent';
import { afterAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import {
  createBrunchAgentSessionRuntimeFactory,
  runBrunchTui,
  type BrunchAgentServicesOverride,
} from '../../app/brunch-tui.js';
import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
} from '../../probes/faux-provider.js';
import { BRUNCH_UPDATED_METHOD } from '../../rpc/product-updates.js';
import { BRUNCH_SESSION_EVENT_METHOD, type SessionEventRelayFrame } from '../../rpc/session-event-relay.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';

const DRIVEN_TEXT =
  'Streamed assistant reply: production relay frames must reduce to canonical transcript truth.';

type ReceivedFrame =
  | SessionEventRelayFrame
  | { readonly jsonrpc: '2.0'; readonly method: typeof BRUNCH_UPDATED_METHOD; readonly params: unknown };

describe('web-driver-streaming production relay seam', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('relays the live AgentSession event stream through runBrunchTui sidecar /rpc, multiplexed with product updates', async () => {
    const faux = registerKeptFauxProvider('KICK opening turn from the product.');
    cleanups.push(() => faux.provider.unregister());

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-fe873-relay-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-fe873-agent-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'FE-873 relay spec' }),
      launchInteractive: async (context) => {
        const runtime = await createAgentSessionRuntime(
          createBrunchAgentSessionRuntimeFactory({ ...context, agentServices: faux.agentServices }),
          { cwd, agentDir, sessionManager: context.workspace.session.manager },
        );
        cleanups.push(() => runtime.dispose());

        await waitFor(
          () => faux.provider.getPendingResponseCount() === 0,
          8000,
          'kick to consume its response',
        );
        await settle(150);

        const sourceEvents: AgentSessionEvent[] = [];
        const unsubscribeSource = runtime.session.subscribe((event) => sourceEvents.push(event));
        cleanups.push(unsubscribeSource);

        if (!context.webSidecarUrl || !context.productUpdates) {
          throw new Error('runBrunchTui did not provide sidecar relay dependencies');
        }
        const received: ReceivedFrame[] = [];
        const client = await openClient(
          `${context.webSidecarUrl.replace(/^http/u, 'ws').replace(/\/spec\/\d+$/u, '')}/rpc`,
        );
        client.on('message', (data: Buffer) =>
          received.push(JSON.parse(data.toString('utf8')) as ReceivedFrame),
        );
        cleanups.push(() => client.close());

        faux.provider.appendResponses([
          (providerContext: Context) => {
            void providerContext;
            return fauxAssistantMessage(DRIVEN_TEXT);
          },
        ]);
        const agentEnded = waitForEvent(runtime.session, 'agent_end');
        await runtime.session.prompt('Drive a streamed turn through the production relay seam.', {
          expandPromptTemplates: false,
          source: 'rpc',
        });
        await agentEnded;

        context.productUpdates.publish({
          topic: 'graph.overview',
          specId: context.workspace.spec.id,
          lsn: 7,
        });
        await waitFor(
          () => received.some((frame) => frame.method === BRUNCH_UPDATED_METHOD),
          2000,
          'domain notification to arrive at the synthetic client',
        );

        const piFrames = received.filter(
          (frame): frame is SessionEventRelayFrame => frame.method === BRUNCH_SESSION_EVENT_METHOD,
        );
        const domainFrames = received.filter((frame) => frame.method === BRUNCH_UPDATED_METHOD);

        expect(piFrames.length).toBeGreaterThan(0);
        expect(piFrames.some((frame) => frame.params.event.type === 'agent_end')).toBe(true);
        expect(domainFrames).toHaveLength(1);

        const relayedSeq = piFrames.map((frame) => frame.params.seq);
        expect(relayedSeq).toEqual([...relayedSeq].sort((a, b) => a - b));
        expect(new Set(relayedSeq).size).toBe(relayedSeq.length);
        expect(sourceEvents.map((event) => event.type).join(',')).toContain(
          piFrames.map((frame) => frame.params.event.type).join(','),
        );

        const updateFrames = piFrames.filter((frame) => frame.params.event.type === 'message_update');
        expect(updateFrames.length).toBeGreaterThan(1);
        expect(assembleAssistantTextFromStream(piFrames.map((frame) => frame.params.event))).toContain(
          DRIVEN_TEXT,
        );

        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);
        expect(await readFile(context.workspace.session.file, 'utf8')).toContain(DRIVEN_TEXT);
      },
    });
  }, 30000);
});

function registerKeptFauxProvider(kickText: string): {
  readonly provider: FauxProviderRegistration;
  readonly agentServices: BrunchAgentServicesOverride;
} {
  const model = defaultBrunchFauxModel();
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-relay-source`,
    models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
  });
  provider.setResponses([() => fauxAssistantMessage(kickText)]);
  const authStorage = AuthStorage.inMemory({
    [model.provider]: { type: 'api_key', key: BRUNCH_FAUX_HARNESS_API_KEY },
  });
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  modelRegistry.registerProvider(
    model.provider,
    brunchFauxProviderConfig(model, provider, BRUNCH_FAUX_HARNESS_API_KEY),
  );
  const registeredModel = modelRegistry.find(model.provider, model.modelId);
  if (!registeredModel) {
    provider.unregister();
    throw new Error(`relay faux model not registered: ${model.provider}/${model.modelId}`);
  }
  return { provider, agentServices: { authStorage, modelRegistry, model: registeredModel } };
}

function assembleAssistantTextFromStream(events: readonly AgentSessionEvent[]): string {
  let text = '';
  for (const event of events) {
    if (event.type !== 'message_update' && event.type !== 'message_end') continue;
    const message = (event as { message?: { role?: string; content?: unknown } }).message;
    if (!message || message.role !== 'assistant' || !Array.isArray(message.content)) continue;
    const joined = message.content
      .flatMap((block: { type?: string; text?: string }) =>
        block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
      )
      .join('\n');
    if (joined.length >= text.length) text = joined;
  }
  return text;
}

function waitForEvent(
  session: { subscribe: (listener: (event: AgentSessionEvent) => void) => () => void },
  type: AgentSessionEvent['type'],
): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = session.subscribe((event) => {
      if (event.type === type) {
        unsubscribe();
        resolve();
      }
    });
  });
}

function openClient(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

async function waitFor(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
    await settle(25);
  }
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
