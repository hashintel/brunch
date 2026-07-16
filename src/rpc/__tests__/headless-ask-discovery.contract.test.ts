import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createAskTool } from '../../.pi/extensions/exchanges/ask.js';
import type { StructuredExchangeUiContext } from '../../.pi/extensions/exchanges/shared/ui-context.js';
import { createLiveAskRegistry, type LiveAskRegistry } from '../../session/live-ask-registry.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { createWebSidecarRpcHandlers, type RpcHandlers } from '../handlers.js';
import { NO_PENDING_LIVE_EXCHANGE_MESSAGE } from '../methods/session-exchange-answer.js';

// Deterministic middle-loop proof of A39-L: a headless client discovers open
// asks and answers them purely over live RPC state, with no transcript parsing
// anywhere on the path (the handlers touch only the registry reader/answerer).

type AskToolResult = { readonly content: unknown; readonly details: unknown; readonly terminate?: true };

const HEADLESS_CTX = { hasUI: false } as unknown as StructuredExchangeUiContext;

function runHeadlessAsk(registry: LiveAskRegistry, params: Record<string, unknown>): Promise<AskToolResult> {
  const tool = createAskTool(registry.opener) as ReturnType<typeof createAskTool> & {
    execute: (
      id: string,
      params: Record<string, unknown>,
      signal: AbortSignal | undefined,
      onUpdate: unknown,
      ctx: unknown,
    ) => Promise<AskToolResult>;
  };
  return tool.execute('drive', params, new AbortController().signal, undefined, HEADLESS_CTX);
}

async function handlersOverRegistry(registry: LiveAskRegistry): Promise<RpcHandlers> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-headless-contract-'));
  return createWebSidecarRpcHandlers({
    coordinator: createWorkspaceSessionCoordinator({ cwd }),
    cwd,
    sessionExchangeAnswer: { answerer: registry.answerer },
    sessionOpenAsks: { reader: registry.reader },
  });
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function openAsksVia(handlers: RpcHandlers, id: number): Promise<unknown> {
  const response = await handlers.handle({ jsonrpc: '2.0', id, method: 'session.openAsks' });
  return (response as { result?: { openAsks?: unknown } }).result?.openAsks;
}

describe('headless ask discover / answer / cancel / resume contract', () => {
  it('discovers an open ask, answers it over RPC, and shows discovery closed', async () => {
    const registry = createLiveAskRegistry();
    const handlers = await handlersOverRegistry(registry);
    const done = runHeadlessAsk(registry, { exchangeId: 'grounding', body: 'Where do we start?' });
    await tick();

    expect(await openAsksVia(handlers, 1)).toEqual([
      { exchangeId: 'grounding', mode: 'text', question: { body: 'Where do we start?' } },
    ]);

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'session.answerExchange',
        params: { exchangeId: 'grounding', answer: 'From a blank slate.' },
      }),
    ).resolves.toEqual({ jsonrpc: '2.0', id: 2, result: { status: 'completed' } });

    expect((await done).details).toMatchObject({ answered: { text: 'From a blank slate.' } });
    expect(await openAsksVia(handlers, 3)).toEqual([]);
  });

  it('rejects a second answer for the same exchange as no-pending (idempotent, no hang)', async () => {
    const registry = createLiveAskRegistry();
    const handlers = await handlersOverRegistry(registry);
    const done = runHeadlessAsk(registry, { exchangeId: 'once', body: 'One answer only?' });
    await tick();

    await handlers.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'session.answerExchange',
      params: { exchangeId: 'once', answer: 'first' },
    });
    await done;

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'session.answerExchange',
        params: { exchangeId: 'once', answer: 'second' },
      }),
    ).resolves.toMatchObject({ error: { code: -32008, message: NO_PENDING_LIVE_EXCHANGE_MESSAGE } });
  });

  it('clears discovery when an open ask is cancelled (turn teardown)', async () => {
    const registry = createLiveAskRegistry();
    const handlers = await handlersOverRegistry(registry);
    const done = runHeadlessAsk(registry, { exchangeId: 'interrupted', body: 'Still here?' });
    await tick();
    expect(await openAsksVia(handlers, 1)).toHaveLength(1);

    registry.cancelAll();

    expect((await done).details).toMatchObject({ cancelled: {} });
    expect(await openAsksVia(handlers, 2)).toEqual([]);
  });

  it('a resumed process discovers nothing and reads a pre-restart id as closed/stale', async () => {
    const before = createLiveAskRegistry();
    void runHeadlessAsk(before, { exchangeId: 'pre-restart', body: 'Survives a restart?' });
    await tick();

    // A restart is a fresh registry with no memory of prior open asks.
    const resumed = createLiveAskRegistry();
    const handlers = await handlersOverRegistry(resumed);

    expect(await openAsksVia(handlers, 1)).toEqual([]);
    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'session.answerExchange',
        params: { exchangeId: 'pre-restart', answer: 'too late' },
      }),
    ).resolves.toMatchObject({ error: { code: -32008, message: NO_PENDING_LIVE_EXCHANGE_MESSAGE } });
  });
});
