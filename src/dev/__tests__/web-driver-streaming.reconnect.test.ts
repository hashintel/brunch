import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, type Context } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime, type AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { afterAll, describe, expect, it } from 'vitest';

import { createBrunchAgentSessionRuntimeFactory, runBrunchTui } from '../../app/brunch-tui.js';
import type { SessionEventRelayFrame } from '../../rpc/session-event-relay.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { emitStartupOrientationForHarness } from '../tier-2-harness.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
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

const TURN_1_TEXT = 'Reconnect turn one: canonical JSONL survives a mid-stream observer drop. '
  .repeat(6)
  .trim();
const TURN_2_TEXT = 'Reconnect turn two: resumed frames still reduce to flushed transcript truth. '
  .repeat(6)
  .trim();

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
    const faux = registerKeptFauxProvider('reconnect', 'KICK opening turn before reconnect proof.');
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
        await emitStartupOrientationForHarness(runtime);

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
