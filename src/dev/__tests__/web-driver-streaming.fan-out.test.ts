import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, type Context } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { afterAll, describe, expect, it } from 'vitest';

import { createBrunchAgentSessionRuntimeFactory, runBrunchTui } from '../../app/brunch-tui.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { emitStartupOrientationForHarness } from '../tier-2-harness.js';
import {
  assembleAssistantTextFromStream,
  contiguousRange,
  latestAssistantTextFromJsonl,
  registerKeptFauxProvider,
  RpcSocket,
  settle,
  waitFor,
  waitForEvent,
} from './web-driver-streaming-support.js';

const FAN_OUT_TEXT = 'Fan-out streamed reply: every observer sees the same relay frame sequence. '
  .repeat(6)
  .trim();

describe('web-driver-streaming observer fan-out', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('fans out one driven turn and domain notifications to concurrent observers while rejecting observer writes', async () => {
    const faux = await registerKeptFauxProvider('fan-out', 'KICK opening turn before fan-out proof.');
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
        await emitStartupOrientationForHarness(runtime);

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
