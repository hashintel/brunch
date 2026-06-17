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
import type { JsonRpcResponse } from '../../rpc/protocol.js';
import { BRUNCH_SESSION_EVENT_METHOD, type SessionEventRelayFrame } from '../../rpc/session-event-relay.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';

const FAN_OUT_TEXT = 'Fan-out streamed reply: every observer sees the same relay frame sequence. '
  .repeat(6)
  .trim();

type BrunchUpdatedFrame = {
  readonly jsonrpc: '2.0';
  readonly method: typeof BRUNCH_UPDATED_METHOD;
  readonly params: unknown;
};

type ReceivedFrame = SessionEventRelayFrame | BrunchUpdatedFrame;

describe('web-driver-streaming observer fan-out', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('fans out one driven turn and domain notifications to concurrent observers while rejecting observer writes', async () => {
    const faux = registerKeptFauxProvider('KICK opening turn before fan-out proof.');
    cleanups.push(() => faux.provider.unregister());

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-fe873-fan-out-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-fe873-agent-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'FE-873 fan-out spec' }),
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

        if (!context.webSidecarUrl || !context.productUpdates) {
          throw new Error('runBrunchTui did not provide sidecar fan-out dependencies');
        }
        const rpcUrl = `${context.webSidecarUrl.replace(/^http/u, 'ws').replace(/\/spec\/\d+$/u, '')}/rpc`;
        const observers = await Promise.all([
          RpcSocket.open(rpcUrl),
          RpcSocket.open(rpcUrl),
          RpcSocket.open(rpcUrl),
        ]);
        for (const observer of observers) cleanups.push(() => observer.close());
        await settle(50);

        await assertReadOnlyObserver(observers[0]);

        faux.provider.appendResponses([
          (providerContext: Context) => {
            void providerContext;
            return fauxAssistantMessage(FAN_OUT_TEXT);
          },
        ]);
        const agentEnded = waitForEvent(runtime.session, 'agent_end');
        await runtime.session.prompt('Drive a fan-out turn through the production relay seam.', {
          expandPromptTemplates: false,
          source: 'rpc',
        });
        await agentEnded;
        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);

        await waitFor(
          () =>
            observers.every(
              (observer) => assembleAssistantTextFromStream(observer.sessionEvents()) === FAN_OUT_TEXT,
            ),
          2000,
          'all observers to receive the driven assistant text',
        );

        context.productUpdates.publish({
          topic: 'graph.overview',
          specId: context.workspace.spec.id,
          lsn: 11,
        });
        await waitFor(
          () => observers.every((observer) => observer.updatedFrames().length === 1),
          2000,
          'domain notification to fan out to all observers',
        );

        const eventFingerprints = observers.map((observer) =>
          observer.sessionFrames().map((frame) => JSON.stringify(frame.params)),
        );
        expect(eventFingerprints[1]).toEqual(eventFingerprints[0]);
        expect(eventFingerprints[2]).toEqual(eventFingerprints[0]);

        for (const observer of observers) {
          const seqs = observer.sessionFrames().map((frame) => frame.params.seq);
          expect(seqs).toEqual(contiguousRange(seqs[0] ?? 0, seqs.length));
          expect(new Set(seqs).size).toBe(seqs.length);
          expect(assembleAssistantTextFromStream(observer.sessionEvents())).toBe(FAN_OUT_TEXT);
        }
        const updateFingerprints = observers.map((observer) =>
          observer.updatedFrames().map((frame) => JSON.stringify(frame.params)),
        );
        expect(updateFingerprints[1]).toEqual(updateFingerprints[0]);
        expect(updateFingerprints[2]).toEqual(updateFingerprints[0]);

        await assertReadOnlyObserver(observers[1]);
        expect(latestAssistantTextFromJsonl(await readFile(context.workspace.session.file, 'utf8'))).toBe(
          FAN_OUT_TEXT,
        );
      },
    });
  }, 30000);
});

async function assertReadOnlyObserver(observer: RpcSocket): Promise<void> {
  await expect(observer.request('session.triggerExchange')).rejects.toMatchObject({
    code: -32601,
    message: 'Method not found',
  });
  await expect(
    observer.request('session.submitMessage', { text: 'observer write attempt' }),
  ).rejects.toMatchObject({
    code: -32601,
    message: 'Method not found',
  });
}

class RpcSocket {
  readonly #socket: WebSocket;
  readonly #frames: ReceivedFrame[] = [];
  readonly #pending = new Map<string | number, (response: JsonRpcResponse) => void>();
  #nextId = 1;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.on('message', (data: Buffer) => this.#receive(data));
  }

  static async open(url: string): Promise<RpcSocket> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });
    return new RpcSocket(socket);
  }

  sessionFrames(): readonly SessionEventRelayFrame[] {
    return this.#frames.filter(
      (frame): frame is SessionEventRelayFrame => frame.method === BRUNCH_SESSION_EVENT_METHOD,
    );
  }

  sessionEvents(): readonly AgentSessionEvent[] {
    return this.sessionFrames().map((frame) => frame.params.event);
  }

  updatedFrames(): readonly BrunchUpdatedFrame[] {
    return this.#frames.filter(
      (frame): frame is BrunchUpdatedFrame => frame.method === BRUNCH_UPDATED_METHOD,
    );
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.#nextId;
    this.#nextId += 1;
    const request =
      params === undefined
        ? { jsonrpc: '2.0' as const, id, method }
        : { jsonrpc: '2.0' as const, id, method, params };
    return new Promise((resolve, reject) => {
      this.#pending.set(id, (response) => {
        if ('error' in response) {
          reject(response.error);
          return;
        }
        resolve(response.result);
      });
      this.#socket.send(JSON.stringify(request));
    });
  }

  close(): void {
    if (this.#socket.readyState === WebSocket.CLOSED || this.#socket.readyState === WebSocket.CLOSING) return;
    this.#socket.close();
  }

  #receive(data: Buffer): void {
    const message = JSON.parse(data.toString('utf8')) as JsonRpcResponse | ReceivedFrame;
    if (
      'method' in message &&
      (message.method === BRUNCH_SESSION_EVENT_METHOD || message.method === BRUNCH_UPDATED_METHOD)
    ) {
      this.#frames.push(message);
      return;
    }
    if ('id' in message && message.id !== null) {
      const resolve = this.#pending.get(message.id);
      if (!resolve) return;
      this.#pending.delete(message.id);
      resolve(message);
    }
  }
}

function registerKeptFauxProvider(kickText: string): {
  readonly provider: FauxProviderRegistration;
  readonly agentServices: BrunchAgentServicesOverride;
} {
  const model = defaultBrunchFauxModel();
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-fan-out`,
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
    throw new Error(`fan-out faux model not registered: ${model.provider}/${model.modelId}`);
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

function latestAssistantTextFromJsonl(jsonl: string): string | undefined {
  const assistantMessages = jsonl
    .trim()
    .split('\n')
    .flatMap((line) => {
      const entry = JSON.parse(line) as { message?: { role?: string; content?: unknown } };
      const message = entry.message;
      if (!message || message.role !== 'assistant' || !Array.isArray(message.content)) return [];
      return [
        message.content
          .flatMap((block: { type?: string; text?: string }) =>
            block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
          )
          .join('\n'),
      ];
    });
  return assistantMessages.at(-1);
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

function contiguousRange(start: number, length: number): readonly number[] {
  return Array.from({ length }, (_, index) => start + index);
}
