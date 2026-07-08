import { fauxAssistantMessage, type FauxProviderRegistration } from '@earendil-works/pi-ai';
import { registerFauxProvider } from '@earendil-works/pi-ai/compat';
import { AuthStorage, ModelRegistry, type AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { WebSocket } from 'ws';

import type { BrunchAgentServicesOverride } from '../../app/brunch-tui.js';
import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
} from '../../probes/faux-provider.js';
import { BRUNCH_UPDATED_METHOD } from '../../rpc/product-updates.js';
import type { JsonRpcResponse } from '../../rpc/protocol.js';
import { BRUNCH_SESSION_EVENT_METHOD, type SessionEventRelayFrame } from '../../rpc/session-event-relay.js';

export type BrunchUpdatedFrame = {
  readonly jsonrpc: '2.0';
  readonly method: typeof BRUNCH_UPDATED_METHOD;
  readonly params: unknown;
};

export type ReceivedFrame = SessionEventRelayFrame | BrunchUpdatedFrame;

export class RpcSocket {
  readonly #socket: WebSocket;
  readonly #frames: ReceivedFrame[] = [];
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

  sessionFrames(): readonly SessionEventRelayFrame[] {
    return this.#frames.filter(
      (frame): frame is SessionEventRelayFrame => frame.method === BRUNCH_SESSION_EVENT_METHOD,
    );
  }

  events(): readonly AgentSessionEvent[] {
    return this.sessionFrames().map((frame) => frame.params.event);
  }

  sessionEvents(): readonly AgentSessionEvent[] {
    return this.events();
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

  terminate(): void {
    if (this.#socket.readyState === WebSocket.CLOSED) return;
    this.#socket.terminate();
  }

  #receive(data: Buffer): void {
    const message = JSON.parse(data.toString('utf8')) as JsonRpcResponse | ReceivedFrame;
    if (
      'method' in message &&
      (message.method === BRUNCH_SESSION_EVENT_METHOD || message.method === BRUNCH_UPDATED_METHOD)
    ) {
      this.#frames.push(message);
      if (message.method === BRUNCH_SESSION_EVENT_METHOD) {
        for (const listener of this.#sessionEventListeners) listener(message);
      }
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

export function registerKeptFauxProvider(
  apiSuffix: string,
  kickText: string,
): {
  readonly provider: FauxProviderRegistration;
  readonly agentServices: BrunchAgentServicesOverride;
} {
  const model = defaultBrunchFauxModel();
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-${apiSuffix}`,
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
    throw new Error(`${apiSuffix} faux model not registered: ${model.provider}/${model.modelId}`);
  }
  return { provider, agentServices: { authStorage, modelRegistry, model: registeredModel } };
}

export function assembleAssistantTextFromStream(events: readonly AgentSessionEvent[]): string {
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

export function hasToolEvent(
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

export function requestAnswerArgsFromStream(events: readonly AgentSessionEvent[]): unknown {
  const event = events.find((candidate) => {
    const shaped = candidate as { type?: unknown; toolName?: unknown };
    return shaped.type === 'tool_execution_start' && shaped.toolName === 'ask';
  }) as { args?: unknown } | undefined;
  return event?.args;
}

export function requestAnswerFromJsonl(jsonl: string): string | undefined {
  for (const line of jsonl.trim().split('\n')) {
    const entry = JSON.parse(line) as { message?: { role?: string; toolName?: string; details?: unknown } };
    const message = entry.message;
    if (message?.role !== 'toolResult' || message.toolName !== 'ask') continue;
    const details = message.details as { answered?: { text?: unknown } } | undefined;
    if (typeof details?.answered?.text === 'string') return details.answered.text;
  }
  return undefined;
}

export function latestAssistantTextFromJsonl(jsonl: string): string | undefined {
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

export function waitForEvent(
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

export async function waitFor(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
    await settle(25);
  }
}

export function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function contiguousRange(start: number, length: number): readonly number[] {
  return Array.from({ length }, (_, index) => start + index);
}
