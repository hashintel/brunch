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

const TURN_1_TEXT = 'Reconnect turn one: canonical JSONL survives a mid-stream observer drop. '
  .repeat(6)
  .trim();
const TURN_2_TEXT = 'Reconnect turn two: resumed frames still reduce to flushed transcript truth. '
  .repeat(6)
  .trim();

type JsonRpcResponse =
  | { readonly jsonrpc: '2.0'; readonly id: string | number | null; readonly result: unknown }
  | {
      readonly jsonrpc: '2.0';
      readonly id: string | number | null;
      readonly error: { readonly message: string };
    };

type ProjectionSnapshot = {
  readonly runtimeState: unknown;
  readonly exchanges: unknown;
};

describe('web-driver-streaming reconnect/resume', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('reconnects by refetching canonical session projections, not replaying relay frames', async () => {
    const faux = registerKeptFauxProvider('KICK opening turn before reconnect proof.');
    cleanups.push(() => faux.provider.unregister());

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-fe873-reconnect-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-fe873-agent-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'FE-873 reconnect spec' }),
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

        if (!context.webSidecarUrl) {
          throw new Error('runBrunchTui did not provide a sidecar URL');
        }
        const rpcUrl = `${context.webSidecarUrl.replace(/^http/u, 'ws').replace(/\/spec\/\d+$/u, '')}/rpc`;
        const projectionParams = {
          sessionId: context.workspace.session.id,
          specId: context.workspace.spec.id,
        };

        const control = await RpcSocket.open(rpcUrl);
        cleanups.push(() => control.close());
        const controlFrames: SessionEventRelayFrame[] = [];
        let droppedAtMidTurn = false;
        let droppedMidTurn: RpcSocket | undefined;
        control.onSessionEvent((frame) => {
          controlFrames.push(frame);
          if (frame.params.event.type === 'message_update' && !droppedAtMidTurn) {
            droppedAtMidTurn = true;
            droppedMidTurn?.terminate();
          }
        });

        droppedMidTurn = await RpcSocket.open(rpcUrl);
        cleanups.push(() => droppedMidTurn?.close());
        const droppedFrames: SessionEventRelayFrame[] = [];
        droppedMidTurn.onSessionEvent((frame) => {
          droppedFrames.push(frame);
          if (frame.params.event.type === 'message_update') droppedMidTurn.terminate();
        });
        await settle(50);

        faux.provider.appendResponses([
          (providerContext: Context) => {
            void providerContext;
            return fauxAssistantMessage(TURN_1_TEXT);
          },
        ]);
        const firstTurnEnded = waitForEvent(runtime.session, 'agent_end');
        await runtime.session.prompt('Drive turn one before reconnect.', {
          expandPromptTemplates: false,
          source: 'rpc',
        });
        await firstTurnEnded;
        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);
        await waitFor(
          () => controlFrames.some((frame) => frame.params.event.type === 'message_update'),
          2000,
          'turn-one message_update relay frame',
        );

        expect(sourceEvents.map((event) => event.type).join(',')).toContain('message_update');
        expect(controlFrames.map((frame) => frame.params.event.type).join(',')).toContain('message_update');
        expect(droppedAtMidTurn).toBe(true);
        expect(droppedFrames.some((frame) => frame.params.event.type === 'agent_end')).toBe(false);
        expect(latestAssistantTextFromJsonl(await readFile(context.workspace.session.file, 'utf8'))).toBe(
          TURN_1_TEXT,
        );

        const maxTurnOneSeq = Math.max(...controlFrames.map((frame) => frame.params.seq));
        const postTurnProjection = await readProjection(control, projectionParams);
        control.close();

        const reconnected = await RpcSocket.open(rpcUrl);
        cleanups.push(() => reconnected.close());
        const reconnectedFrames: SessionEventRelayFrame[] = [];
        reconnected.onSessionEvent((frame) => reconnectedFrames.push(frame));
        await settle(150);
        expect(reconnectedFrames).toEqual([]);
        await expect(readProjection(reconnected, projectionParams)).resolves.toEqual(postTurnProjection);

        faux.provider.appendResponses([
          (providerContext: Context) => {
            void providerContext;
            return fauxAssistantMessage(TURN_2_TEXT);
          },
        ]);
        const secondTurnEnded = waitForEvent(runtime.session, 'agent_end');
        await runtime.session.prompt('Drive turn two after reconnect.', {
          expandPromptTemplates: false,
          source: 'rpc',
        });
        await secondTurnEnded;
        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);
        await waitFor(
          () =>
            assembleAssistantTextFromStream(reconnectedFrames.map((frame) => frame.params.event)) ===
            TURN_2_TEXT,
          2000,
          'turn-two streamed assistant text at reconnected observer',
        );

        expect(reconnectedFrames.length).toBeGreaterThan(0);
        expect(reconnectedFrames.every((frame) => frame.params.seq > maxTurnOneSeq)).toBe(true);
        expect(reconnectedFrames.map((frame) => frame.params.seq)).toEqual(
          contiguousRange(reconnectedFrames[0]?.params.seq ?? 0, reconnectedFrames.length),
        );
        expect(assembleAssistantTextFromStream(reconnectedFrames.map((frame) => frame.params.event))).toBe(
          TURN_2_TEXT,
        );
        expect(latestAssistantTextFromJsonl(await readFile(context.workspace.session.file, 'utf8'))).toBe(
          TURN_2_TEXT,
        );
      },
    });
  }, 30000);
});

async function readProjection(
  client: RpcSocket,
  params: { readonly sessionId: string; readonly specId: number },
): Promise<ProjectionSnapshot> {
  const [runtimeState, exchanges] = await Promise.all([
    client.request('session.runtimeState', params),
    client.request('session.exchanges', params),
  ]);
  return { runtimeState, exchanges };
}

class RpcSocket {
  readonly #socket: WebSocket;
  readonly #sessionEventListeners = new Set<(frame: SessionEventRelayFrame) => void>();
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

  onSessionEvent(listener: (frame: SessionEventRelayFrame) => void): void {
    this.#sessionEventListeners.add(listener);
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.#nextId;
    this.#nextId += 1;
    const request = { jsonrpc: '2.0' as const, id, method, params };
    return new Promise((resolve, reject) => {
      this.#pending.set(id, (response) => {
        if ('error' in response) {
          reject(new Error(response.error.message));
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

  terminate(): void {
    if (this.#socket.readyState === WebSocket.CLOSED) return;
    this.#socket.terminate();
  }

  #receive(data: Buffer): void {
    const message = JSON.parse(data.toString('utf8')) as JsonRpcResponse | SessionEventRelayFrame;
    if ('method' in message && message.method === BRUNCH_SESSION_EVENT_METHOD) {
      for (const listener of this.#sessionEventListeners) listener(message);
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
    api: `${model.api}-reconnect`,
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
    throw new Error(`reconnect faux model not registered: ${model.provider}/${model.modelId}`);
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
