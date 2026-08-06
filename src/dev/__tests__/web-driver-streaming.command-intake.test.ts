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
  assembleLiveAssistantText,
  contiguousRange,
  latestAssistantTextFromJsonl,
  registerKeptFauxProvider,
  RpcSocket,
  settle,
  waitFor,
} from './web-driver-streaming-support.js';

const WEB_DRIVEN_TEXT = 'Web command-intake reply: the browser sidecar re-enters the live AgentSession. '
  .repeat(5)
  .trim();

describe('web-driver-streaming command intake', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('lets a web RPC command drive the live AgentSession turn and fan it out to observers', async () => {
    const faux = await registerKeptFauxProvider(
      'command-intake',
      'KICK opening turn before command-intake proof.',
    );
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
        await emitStartupOrientationForHarness(runtime);

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
            assembleAssistantTextFromStream(driver.events()) === WEB_DRIVEN_TEXT &&
            observers.every(
              (observer) => assembleLiveAssistantText(observer.liveSessionEvents()) === WEB_DRIVEN_TEXT,
            ),
          3000,
          'driver and observers to receive the web-driven assistant text',
        );
        flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);

        const driverSeqs = driver.sessionFrames().map((frame) => frame.params.seq);
        expect(driverSeqs).toEqual(contiguousRange(driverSeqs[0] ?? 0, driverSeqs.length));
        expect(new Set(driverSeqs).size).toBe(driverSeqs.length);
        expect(assembleAssistantTextFromStream(driver.events())).toBe(WEB_DRIVEN_TEXT);

        const observerFingerprints = observers.map((observer) =>
          observer.liveSessionEvents().map((frame) => JSON.stringify(frame.params)),
        );
        expect(observerFingerprints[1]).toEqual(observerFingerprints[0]);
        for (const observer of observers) {
          expect(assembleLiveAssistantText(observer.liveSessionEvents())).toBe(WEB_DRIVEN_TEXT);
          expect(observer.sessionFrames()).toEqual([]);
        }
        expect(latestAssistantTextFromJsonl(await readFile(context.workspace.session.file, 'utf8'))).toBe(
          WEB_DRIVEN_TEXT,
        );
      },
    });
  }, 30000);
});
