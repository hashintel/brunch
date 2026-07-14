import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { afterAll, describe, expect, it } from 'vitest';

import { runBrunchWeb } from '../../app/brunch-web.js';
import type { SessionPresentationResult } from '../../projections/session/session-presentation.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { registerKeptFauxProvider, RpcSocket, waitFor } from './web-driver-streaming-support.js';

const question = 'What proves the browser answer path?';

describe('standalone web session host production entry', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('opens an existing target, drives text plus ask, and rehydrates durable settled presentation', async () => {
    const faux = registerKeptFauxProvider('standalone-web', 'Standalone opening turn.');
    cleanups.push(() => faux.provider.unregister());
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-standalone-web-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({ specTitle: 'Standalone web proof' });
    const target = { specId: workspace.spec.id, sessionId: workspace.session.id };
    const host = await runBrunchWeb({ cwd, coordinator, agentServices: faux.agentServices });
    cleanups.push(() => host.close());
    const rpc = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    cleanups.push(() => rpc.close());

    await expect(rpc.request('session.open', target)).resolves.toMatchObject({ status: 'opened' });
    await waitFor(() => faux.provider.getPendingResponseCount() === 0, 8000, 'startup turn');
    faux.provider.appendResponses([
      () =>
        fauxAssistantMessage(
          [fauxToolCall('ask', { exchangeId: 'web-ask', body: question }, { id: 'web-ask-call' })],
          { stopReason: 'toolUse' },
        ),
      () => fauxAssistantMessage('Durable answer complete.'),
    ]);

    const turn = rpc.request('session.driveTurn', {
      ...target,
      driverId: 'browser-proof',
      prompt: 'Run the deterministic ask.',
    });
    await waitFor(asyncOpenAsk, 8000, 'open ask');
    async function asyncOpenAsk(): Promise<boolean> {
      const result = (await rpc.request('session.openAsks', target)) as { asks: unknown[] };
      return result.asks.length === 1;
    }
    await expect(
      rpc.request('session.answerExchange', {
        ...target,
        driverId: 'browser-proof',
        exchangeId: 'web-ask',
        answer: 'The target-addressed broker.',
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    await expect(turn).resolves.toMatchObject({ status: 'completed' });

    const projected = (await rpc.request('session.presentation', target)) as SessionPresentationResult;
    expect(projected).toMatchObject({ status: 'ready' });
    if (projected.status !== 'ready') return;
    expect(projected.presentation.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'ask',
          exchangeId: 'web-ask',
          answer: 'The target-addressed broker.',
        }),
        expect.objectContaining({ kind: 'message', role: 'assistant', text: 'Durable answer complete.' }),
      ]),
    );
  });
});
