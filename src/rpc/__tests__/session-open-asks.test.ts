import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLiveAskRegistry } from '../../session/live-ask-registry.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { createReadOnlyRpcHandlers, createWebSidecarRpcHandlers } from '../handlers.js';

async function coordinatorInTmp() {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-open-asks-'));
  return { cwd, coordinator: createWorkspaceSessionCoordinator({ cwd }) };
}

function discoveredMethods(response: unknown): string[] {
  const methods = (response as { result?: { methods?: Array<{ method: string }> } }).result?.methods ?? [];
  return methods.map((entry) => entry.method);
}

function discoveredResultSchema(response: unknown, method: string): unknown {
  const methods = (response as { result?: { methods?: Array<{ method: string; resultSchema: unknown }> } })
    .result?.methods;
  return methods?.find((entry) => entry.method === method)?.resultSchema;
}

describe('session.openAsks public RPC read method', () => {
  it('discovers open asks with their full question payload when the registry handle is attached', async () => {
    const { cwd, coordinator } = await coordinatorInTmp();
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(
      {
        exchangeId: 'grounding',
        mode: 'single-select',
        question: { body: 'Where do we start?', options: [{ id: 'scratch', label: 'From scratch' }] },
      },
      new AbortController().signal,
    );

    const handlers = createWebSidecarRpcHandlers({
      coordinator,
      cwd,
      sessionOpenAsks: { reader: registry.reader },
    });

    const discovery = await handlers.handle({ jsonrpc: '2.0', id: 1, method: 'rpc.discover' });
    expect(discoveredMethods(discovery)).toContain('session.openAsks');
    expect(JSON.stringify(discoveredResultSchema(discovery, 'session.openAsks'))).toContain('questionnaire');

    await expect(handlers.handle({ jsonrpc: '2.0', id: 2, method: 'session.openAsks' })).resolves.toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: {
        openAsks: [
          {
            exchangeId: 'grounding',
            mode: 'single-select',
            question: { body: 'Where do we start?', options: [{ id: 'scratch', label: 'From scratch' }] },
          },
        ],
      },
    });
  });

  it('rejects params and reflects answered asks dropping out of discovery', async () => {
    const { cwd, coordinator } = await coordinatorInTmp();
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(
      { exchangeId: 'q1', mode: 'text', question: { body: 'One?' } },
      new AbortController().signal,
    );
    const handlers = createWebSidecarRpcHandlers({
      coordinator,
      cwd,
      sessionOpenAsks: { reader: registry.reader },
    });

    await expect(
      handlers.handle({ jsonrpc: '2.0', id: 3, method: 'session.openAsks', params: { sessionId: 'x' } }),
    ).resolves.toMatchObject({ error: { code: -32602 } });

    registry.answerer.submitAnswer({ exchangeId: 'q1', answer: 'done' });
    await expect(handlers.handle({ jsonrpc: '2.0', id: 4, method: 'session.openAsks' })).resolves.toEqual({
      jsonrpc: '2.0',
      id: 4,
      result: { openAsks: [] },
    });
  });

  it('is not discoverable and rejects as method-not-found on ordinary read-only observers', async () => {
    const { cwd, coordinator } = await coordinatorInTmp();
    const handlers = createReadOnlyRpcHandlers({ coordinator, cwd });

    const discovery = await handlers.handle({ jsonrpc: '2.0', id: 5, method: 'rpc.discover' });
    expect(discoveredMethods(discovery)).not.toContain('session.openAsks');

    await expect(
      handlers.handle({ jsonrpc: '2.0', id: 6, method: 'session.openAsks' }),
    ).resolves.toMatchObject({ error: { code: -32601, message: 'Method not found' } });
  });

  it('is not discoverable on the driver leg when no registry handle is attached', async () => {
    const { cwd, coordinator } = await coordinatorInTmp();
    const handlers = createWebSidecarRpcHandlers({
      coordinator,
      cwd,
      sessionTurnDriver: {
        async prompt() {
          return { driven: false };
        },
      },
    });

    const discovery = await handlers.handle({ jsonrpc: '2.0', id: 7, method: 'rpc.discover' });
    expect(discoveredMethods(discovery)).not.toContain('session.openAsks');
  });
});
