import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fauxAssistantMessage,
  fauxToolCall,
  registerFauxProvider,
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
import { createWebSidecarRpcHandlers } from '../../rpc/handlers.js';
import { NO_PENDING_LIVE_EXCHANGE_MESSAGE } from '../../rpc/methods/session-exchange-answer.js';
import type { JsonRpcResponse } from '../../rpc/protocol.js';
import { BRUNCH_SESSION_EVENT_METHOD, type SessionEventRelayFrame } from '../../rpc/session-event-relay.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';

const EXCHANGE_ID = 'live-answer-proof';
const QUESTION = 'What should the web answer leg prove?';
const ANSWER = 'The browser resolves the in-turn request_answer promise.';
const FINAL_TEXT = 'Answered exchange complete; the transcript now carries the live answer.';

describe('web-driver-streaming live exchange answer broker', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('lets the web answer a live request_answer turn and converge back to JSONL truth', async () => {
    const faux = registerKeptFauxProvider('KICK opening turn before live exchange proof.');
    cleanups.push(() => faux.provider.unregister());

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-fe873-exchange-answer-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-fe873-agent-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'FE-873 live answer spec' }),
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

        await expect(driver.request('rpc.discover')).resolves.toMatchObject({
          methods: expect.arrayContaining([expect.objectContaining({ method: 'session.answerExchange' })]),
        });

        faux.provider.appendResponses([
          () =>
            fauxAssistantMessage(
              [
                fauxToolCall(
                  'present_question',
                  {
                    exchangeId: EXCHANGE_ID,
                    heading: QUESTION,
                    body: 'This present result must become discoverable while request_answer is blocked.',
                    expectedRequestTool: 'request_answer',
                  },
                  { id: 'present-live-answer-call' },
                ),
                fauxToolCall(
                  'request_answer',
                  {
                    exchangeId: EXCHANGE_ID,
                    prompt: QUESTION,
                    respondsToPresentTool: 'present_question',
                  },
                  { id: 'request-live-answer-call' },
                ),
              ],
              { stopReason: 'toolUse' },
            ),
          () => fauxAssistantMessage(FINAL_TEXT),
        ]);

        const drivePromise = driver.request('session.driveTurn', {
          prompt: 'Drive a live structured exchange from the browser sidecar.',
        });
        await waitFor(
          () =>
            [driver, ...observers].every((client) =>
              hasToolEvent(client.events(), 'request_answer', 'start'),
            ),
          4000,
          'request_answer to start and block',
        );
        await expect(
          Promise.race([drivePromise.then(() => 'completed'), settle(100).then(() => 'blocked')]),
        ).resolves.toBe('blocked');

        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);
        const pendingOrIdle = await driver.request('session.pendingExchange');
        if ((pendingOrIdle as { status?: unknown }).status === 'pending') {
          expect(pendingOrIdle).toMatchObject({
            status: 'pending',
            exchange: { exchangeId: EXCHANGE_ID, prompt: QUESTION, mode: 'text' },
          });
        } else {
          expect(requestAnswerArgsFromStream(driver.events())).toMatchObject({
            exchangeId: EXCHANGE_ID,
            prompt: QUESTION,
          });
        }

        await expect(
          driver.request('session.answerExchange', { exchangeId: EXCHANGE_ID, answer: ANSWER }),
        ).resolves.toEqual({ status: 'completed' });
        await expect(drivePromise).resolves.toEqual({ status: 'completed' });
        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);

        await expect(
          driver.request('session.answerExchange', { exchangeId: EXCHANGE_ID, answer: ANSWER }),
        ).rejects.toMatchObject({ code: -32008, message: NO_PENDING_LIVE_EXCHANGE_MESSAGE });
        await expect(driver.request('session.pendingExchange')).resolves.toEqual({
          status: 'idle',
          exchange: null,
        });

        await waitFor(
          () =>
            [driver, ...observers].every(
              (client) => assembleAssistantTextFromStream(client.events()) === FINAL_TEXT,
            ),
          3000,
          'answered turn to finish and fan out',
        );
        const fingerprints = [driver, ...observers].map((client) =>
          client.sessionFrames().map((frame) => JSON.stringify(frame.params)),
        );
        expect(fingerprints[1]).toEqual(fingerprints[0]);
        expect(fingerprints[2]).toEqual(fingerprints[0]);

        const jsonl = await readFile(context.workspace.session.file, 'utf8');
        expect(requestAnswerFromJsonl(jsonl)).toBe(ANSWER);
        expect(latestAssistantTextFromJsonl(jsonl)).toBe(FINAL_TEXT);
      },
    });
  }, 30000);

  it('does not discover session.answerExchange when no broker handle is attached', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-fe873-no-answer-handle-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const handlers = createWebSidecarRpcHandlers({ coordinator, cwd });

    await expect(handlers.handle({ jsonrpc: '2.0', id: 1, method: 'rpc.discover' })).resolves.toMatchObject({
      result: {
        methods: expect.not.arrayContaining([expect.objectContaining({ method: 'session.answerExchange' })]),
      },
    });
    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'session.answerExchange',
        params: { exchangeId: EXCHANGE_ID, answer: ANSWER },
      }),
    ).resolves.toMatchObject({ error: { code: -32601, message: 'Method not found' } });
  });
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
    api: `${model.api}-exchange-answer`,
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
    throw new Error(`exchange-answer faux model not registered: ${model.provider}/${model.modelId}`);
  }
  return { provider, agentServices: { authStorage, modelRegistry, model: registeredModel } };
}

function hasToolEvent(
  events: readonly AgentSessionEvent[],
  toolName: string,
  phase: 'start' | 'end',
): boolean {
  const type = phase === 'start' ? 'tool_execution_start' : 'tool_execution_end';
  return events.some((event) => {
    const candidate = event as { type?: unknown; toolName?: unknown };
    return candidate.type === type && candidate.toolName === toolName;
  });
}

function requestAnswerArgsFromStream(events: readonly AgentSessionEvent[]): unknown {
  const event = events.find((candidate) => {
    const shaped = candidate as { type?: unknown; toolName?: unknown };
    return shaped.type === 'tool_execution_start' && shaped.toolName === 'request_answer';
  }) as { args?: unknown } | undefined;
  return event?.args;
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

function requestAnswerFromJsonl(jsonl: string): string | undefined {
  for (const line of jsonl.trim().split('\n')) {
    const entry = JSON.parse(line) as { message?: { role?: string; toolName?: string; details?: unknown } };
    const message = entry.message;
    if (message?.role !== 'toolResult' || message.toolName !== 'request_answer') continue;
    const details = message.details as { answered?: { text?: unknown } } | undefined;
    if (typeof details?.answered?.text === 'string') return details.answered.text;
  }
  return undefined;
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

async function waitFor(check: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await settle(25);
  }
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
