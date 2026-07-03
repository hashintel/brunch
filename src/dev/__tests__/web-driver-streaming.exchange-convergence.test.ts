import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { afterAll, describe, expect, it } from 'vitest';

import { createBrunchAgentSessionRuntimeFactory, runBrunchTui } from '../../app/brunch-tui.js';
import { emitStartupOrientationForHarness } from '../tier-2-harness.js';
import { createWebSidecarRpcHandlers } from '../../rpc/handlers.js';
import { NO_PENDING_LIVE_EXCHANGE_MESSAGE } from '../../rpc/methods/session-exchange-answer.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import {
  assembleAssistantTextFromStream,
  hasToolEvent,
  latestAssistantTextFromJsonl,
  registerKeptFauxProvider,
  requestAnswerArgsFromStream,
  requestAnswerFromJsonl,
  RpcSocket,
  settle,
  waitFor,
} from './web-driver-streaming-support.js';

const EXCHANGE_ID = 'live-answer-proof';
const QUESTION = 'What should the web answer leg prove?';
const ANSWER = 'The browser resolves the in-turn request_response promise.';
const FINAL_TEXT = 'Answered exchange complete; the transcript now carries the live answer.';

describe('web-driver-streaming live exchange answer broker', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('lets the web answer a live request_response turn and converge back to JSONL truth', async () => {
    const faux = registerKeptFauxProvider('exchange-answer', 'KICK opening turn before live exchange proof.');
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
                    body: 'This present result must become discoverable while request_response is blocked.',
                  },
                  { id: 'present-live-answer-call' },
                ),
                fauxToolCall(
                  'request_response',
                  {
                    exchangeId: EXCHANGE_ID,
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
              hasToolEvent(client.events(), 'request_response', 'start'),
            ),
          4000,
          'request_response to start and block',
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
