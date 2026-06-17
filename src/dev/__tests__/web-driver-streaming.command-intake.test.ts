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
import { BRUNCH_SESSION_EVENT_METHOD, type SessionEventRelayFrame } from '../../rpc/session-event-relay.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';

const WEB_DRIVEN_TEXT = 'Web command-intake reply: the browser sidecar re-enters the live AgentSession. '
  .repeat(5)
  .trim();

type JsonRpcResponse =
  | { readonly jsonrpc: '2.0'; readonly id: string | number | null; readonly result: unknown }
  | {
      readonly jsonrpc: '2.0';
      readonly id: string | number | null;
      readonly error: { readonly code: number; readonly message: string };
    };

describe('web-driver-streaming command intake', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('lets a web RPC command drive the live AgentSession turn and fan it out to observers', async () => {
    const faux = registerKeptFauxProvider('KICK opening turn before command-intake proof.');
    cleanups.push(() => faux.provider.unregister());

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-fe873-command-intake-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-fe873-agent-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'FE-873 command-intake spec' }),
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

        if (!context.webSidecarUrl) {
          throw new Error('runBrunchTui did not provide a sidecar URL');
        }
        const sidecarBaseUrl = context.webSidecarUrl.replace(/^http/u, 'ws').replace(/\/spec\/\d+$/u, '');
        const driver = await RpcSocket.open(`${sidecarBaseUrl}/rpc/driver`);
        const observers = await Promise.all([
          RpcSocket.open(`${sidecarBaseUrl}/rpc`),
          RpcSocket.open(`${sidecarBaseUrl}/rpc`),
        ]);
        cleanups.push(() => driver.close());
        for (const observer of observers) cleanups.push(() => observer.close());
        await settle(50);

        await expect(driver.request('session.triggerExchange')).rejects.toMatchObject({
          code: -32601,
          message: 'Method not found',
        });

        faux.provider.appendResponses([
          (providerContext: Context) => {
            void providerContext;
            return fauxAssistantMessage(WEB_DRIVEN_TEXT);
          },
        ]);
        await expect(
          driver.request('session.driveTurn', {
            prompt: 'Drive a plain assistant turn from the web command-intake seam.',
          }),
        ).resolves.toEqual({ status: 'completed' });

        await waitFor(
          () =>
            [driver, ...observers].every(
              (client) => assembleAssistantTextFromStream(client.events()) === WEB_DRIVEN_TEXT,
            ),
          3000,
          'driver and observers to receive the web-driven assistant text',
        );
        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);

        const fingerprints = [driver, ...observers].map((client) =>
          client.sessionFrames().map((frame) => JSON.stringify(frame.params)),
        );
        expect(fingerprints[1]).toEqual(fingerprints[0]);
        expect(fingerprints[2]).toEqual(fingerprints[0]);

        for (const client of [driver, ...observers]) {
          const seqs = client.sessionFrames().map((frame) => frame.params.seq);
          expect(seqs).toEqual(contiguousRange(seqs[0] ?? 0, seqs.length));
          expect(new Set(seqs).size).toBe(seqs.length);
          expect(assembleAssistantTextFromStream(client.events())).toBe(WEB_DRIVEN_TEXT);
        }
        expect(latestAssistantTextFromJsonl(await readFile(context.workspace.session.file, 'utf8'))).toBe(
          WEB_DRIVEN_TEXT,
        );
      },
    });
  }, 30000);
});

class RpcSocket {
  readonly #socket: WebSocket;
  readonly #frames: SessionEventRelayFrame[] = [];
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
    return this.#frames;
  }

  events(): readonly AgentSessionEvent[] {
    return this.#frames.map((frame) => frame.params.event);
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
    const message = JSON.parse(data.toString('utf8')) as JsonRpcResponse | SessionEventRelayFrame;
    if ('method' in message && message.method === BRUNCH_SESSION_EVENT_METHOD) {
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
    api: `${model.api}-command-intake`,
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
    throw new Error(`command-intake faux model not registered: ${model.provider}/${model.modelId}`);
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
