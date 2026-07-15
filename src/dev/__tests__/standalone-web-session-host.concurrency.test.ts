import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, fauxToolCall, type Context } from '@earendil-works/pi-ai';
import { afterAll, describe, expect, it } from 'vitest';

import { runBrunchWeb } from '../../app/brunch-web.js';
import type { SessionPresentationResult } from '../../projections/session/session-presentation.js';
import type { LiveSessionEvent, SessionTarget } from '../../session/live-session-host.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import {
  contiguousRange,
  registerKeptFauxProvider,
  RpcSocket,
  waitFor,
} from './web-driver-streaming-support.js';

interface ReadyPresentation {
  readonly status: 'ready';
  readonly presentation: Extract<SessionPresentationResult, { status: 'ready' }>['presentation'];
}

function latestUserText(context: Context): string {
  const message = [...context.messages].reverse().find((candidate) => candidate.role === 'user');
  if (!message || message.role !== 'user') throw new Error('Expected a user prompt in faux context');
  if (typeof message.content === 'string') return message.content;
  return message.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
}

function twoPartyBarrier(): () => Promise<void> {
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrivals += 1;
    if (arrivals === 2) release();
    await ready;
  };
}

function targetEvents(rpc: RpcSocket, target: SessionTarget): LiveSessionEvent[] {
  return rpc
    .sessionFrames()
    .map((frame) => frame.params as unknown as LiveSessionEvent)
    .filter((event) => event.target.specId === target.specId && event.target.sessionId === target.sessionId);
}

async function presentation(rpc: RpcSocket, target: SessionTarget): Promise<ReadyPresentation> {
  const result = (await rpc.request('session.presentation', target)) as SessionPresentationResult;
  expect(result).toMatchObject({ status: 'ready' });
  if (result.status !== 'ready') throw new Error(`Expected ready presentation for ${target.sessionId}`);
  return result;
}

function presentationText(result: ReadyPresentation): string {
  return result.presentation.entries
    .map((entry) =>
      entry.kind === 'message'
        ? entry.text
        : entry.kind === 'present_candidates'
          ? `${entry.heading}\n${entry.candidates.map((candidate) => candidate.title).join('\n')}`
          : entry.kind === 'present_digest'
            ? `${entry.heading}\n${entry.digest.abstract}`
            : entry.kind === 'present_review_set'
              ? `${entry.heading}\n${entry.reviewSet.nodes.map((node) => node.title).join('\n')}`
              : `${entry.question}\n${
                  entry.terminal?.status === 'answered' && 'text' in entry.terminal.value
                    ? entry.terminal.value.text
                    : ''
                }`,
    )
    .join('\n');
}

function parseJsonl(jsonl: string): Array<Record<string, unknown>> {
  return jsonl
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function withoutWorldUpdates(entries: readonly Record<string, unknown>[]): string {
  return JSON.stringify(entries.filter((entry) => entry.customType !== 'worldUpdate'));
}

function worldUpdates(entries: readonly Record<string, unknown>[]): string {
  return JSON.stringify(entries.filter((entry) => entry.customType === 'worldUpdate'));
}

function graphTurnResponse(context: Context) {
  const prompt = latestUserText(context);
  const suffix = prompt.includes('target A') ? 'a' : 'b';
  return fauxAssistantMessage(
    [
      fauxToolCall(
        'mutate_graph',
        {
          ops: [
            {
              op: 'create_node',
              ref: `node-${suffix}`,
              plane: 'intent',
              kind: 'context',
              title: `Concurrent graph marker ${suffix.toUpperCase()}`,
            },
          ],
        },
        { id: `graph-${suffix}` },
      ),
    ],
    { stopReason: 'toolUse' },
  );
}

function askTurnResponse(context: Context) {
  const prompt = latestUserText(context);
  const suffix = prompt.includes('target A') ? 'a' : 'b';
  return fauxAssistantMessage(
    [
      fauxToolCall(
        'ask',
        { exchangeId: `concurrent-ask-${suffix}`, body: `Question for target ${suffix.toUpperCase()}?` },
        { id: `ask-call-${suffix}` },
      ),
    ],
    { stopReason: 'toolUse' },
  );
}

describe('standalone web concurrent session isolation', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('isolates two production-wired targets under interleaved asks, graph writes, failure, and reconnect', async () => {
    const faux = registerKeptFauxProvider('standalone-web-concurrency', 'unused');
    cleanups.push(() => faux.provider.unregister());
    faux.provider.setResponses([
      () => fauxAssistantMessage('Concurrent opening A.'),
      () => fauxAssistantMessage('Concurrent opening B.'),
    ]);

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-standalone-web-concurrency-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspaceA = await coordinator.createSetupSession({ specTitle: 'Concurrent web proof' });
    const workspaceB = await coordinator.createSetupSessionForCurrentSpec();
    if (workspaceB.status !== 'ready') throw new Error('Failed to create the second target session');
    const targetA = { specId: workspaceA.spec.id, sessionId: workspaceA.session.id };
    const targetB = { specId: workspaceB.spec.id, sessionId: workspaceB.session.id };

    const host = await runBrunchWeb({ cwd, coordinator, agentServices: faux.agentServices });
    cleanups.push(() => host.close());
    const rpc = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    cleanups.push(() => rpc.close());

    await expect(
      Promise.all([rpc.request('session.open', targetA), rpc.request('session.open', targetB)]),
    ).resolves.toEqual([{ status: 'opened' }, { status: 'opened' }]);
    await expect(rpc.request('session.open', targetA)).resolves.toEqual({ status: 'attached' });
    await waitFor(() => faux.provider.state.callCount >= 2, 8000, 'both startup turns');

    const graphBarrier = twoPartyBarrier();
    faux.provider.appendResponses([
      async (context) => {
        await graphBarrier();
        return graphTurnResponse(context);
      },
      async (context) => {
        await graphBarrier();
        return graphTurnResponse(context);
      },
      (context) => fauxAssistantMessage(`Graph settled for ${latestUserText(context)}.`),
      (context) => fauxAssistantMessage(`Graph settled for ${latestUserText(context)}.`),
    ]);
    await expect(
      Promise.all([
        rpc.request('session.driveTurn', {
          ...targetA,
          driverId: 'driver-a',
          prompt: 'Mutate shared graph from target A.',
        }),
        rpc.request('session.driveTurn', {
          ...targetB,
          driverId: 'driver-b',
          prompt: 'Mutate shared graph from target B.',
        }),
      ]),
    ).resolves.toEqual([{ status: 'completed' }, { status: 'completed' }]);

    const overview = (await rpc.request('graph.overview', { specId: targetA.specId })) as {
      nodes: readonly { title: string }[];
      lsn: number;
    };
    expect(overview.nodes.map((node) => node.title)).toEqual(
      expect.arrayContaining(['Concurrent graph marker A', 'Concurrent graph marker B']),
    );
    expect(overview.lsn).toBeGreaterThanOrEqual(3);

    const askBarrier = twoPartyBarrier();
    faux.provider.appendResponses([
      async (context) => {
        await askBarrier();
        return askTurnResponse(context);
      },
      async (context) => {
        await askBarrier();
        return askTurnResponse(context);
      },
      (context) => fauxAssistantMessage(`Ask settled for ${latestUserText(context)}.`),
      (context) => fauxAssistantMessage(`Ask settled for ${latestUserText(context)}.`),
    ]);
    const askTurnA = rpc.request('session.driveTurn', {
      ...targetA,
      driverId: 'driver-a',
      prompt: 'Open ask for target A.',
    });
    const askTurnB = rpc.request('session.driveTurn', {
      ...targetB,
      driverId: 'driver-b',
      prompt: 'Open ask for target B.',
    });
    await waitFor(
      async () => {
        const [asksA, asksB] = (await Promise.all([
          rpc.request('session.openAsks', targetA),
          rpc.request('session.openAsks', targetB),
        ])) as [{ asks: unknown[] }, { asks: unknown[] }];
        return asksA.asks.length === 1 && asksB.asks.length === 1;
      },
      8000,
      'both target-local asks',
    );

    await expect(
      rpc.request('session.answerExchange', {
        ...targetB,
        driverId: 'driver-a',
        exchangeId: 'concurrent-ask-b',
        answer: 'wrong driver',
      }),
    ).resolves.toEqual({ status: 'driver_conflict' });
    await expect(
      rpc.request('session.answerExchange', {
        ...targetA,
        driverId: 'driver-a',
        exchangeId: 'concurrent-ask-b',
        answer: 'wrong target',
      }),
    ).resolves.toEqual({ status: 'ask_closed' });

    await expect(
      Promise.all([
        rpc.request('session.answerExchange', {
          ...targetA,
          driverId: 'driver-a',
          exchangeId: 'concurrent-ask-a',
          answer: 'answer-a',
        }),
        rpc.request('session.answerExchange', {
          ...targetB,
          driverId: 'driver-b',
          exchangeId: 'concurrent-ask-b',
          answer: 'answer-b',
        }),
      ]),
    ).resolves.toEqual([{ status: 'completed' }, { status: 'completed' }]);
    await expect(Promise.all([askTurnA, askTurnB])).resolves.toEqual([
      { status: 'completed' },
      { status: 'completed' },
    ]);

    const failureBarrier = twoPartyBarrier();
    faux.provider.appendResponses([
      async (context) => {
        await failureBarrier();
        return latestUserText(context).includes('target A')
          ? fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'isolated target A failure' })
          : fauxAssistantMessage('Target B survives target A failure.');
      },
      async (context) => {
        await failureBarrier();
        return latestUserText(context).includes('target A')
          ? fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'isolated target A failure' })
          : fauxAssistantMessage('Target B survives target A failure.');
      },
    ]);
    await Promise.all([
      rpc.request('session.driveTurn', {
        ...targetA,
        driverId: 'driver-a',
        prompt: 'Fail target A only.',
      }),
      rpc.request('session.driveTurn', {
        ...targetB,
        driverId: 'driver-b',
        prompt: 'Keep target B healthy.',
      }),
    ]);
    faux.provider.appendResponses([() => fauxAssistantMessage('Target A recovered for later work.')]);
    await expect(
      rpc.request('session.driveTurn', {
        ...targetA,
        driverId: 'driver-a',
        prompt: 'Recover target A after its failure.',
      }),
    ).resolves.toEqual({ status: 'completed' });

    const allEvents = rpc.sessionFrames().map((frame) => frame.params as unknown as LiveSessionEvent);
    const eventsA = targetEvents(rpc, targetA);
    const eventsB = targetEvents(rpc, targetB);
    expect(eventsA.length + eventsB.length).toBe(allEvents.length);
    expect(eventsA.map((event) => event.seq)).toEqual(contiguousRange(0, eventsA.length));
    expect(eventsB.map((event) => event.seq)).toEqual(contiguousRange(0, eventsB.length));
    expect(eventsA.every((event) => event.target.sessionId === targetA.sessionId)).toBe(true);
    expect(eventsB.every((event) => event.target.sessionId === targetB.sessionId)).toBe(true);
    expect(JSON.stringify(eventsA)).not.toContain('concurrent-ask-b');
    expect(JSON.stringify(eventsB)).not.toContain('concurrent-ask-a');

    const reconnect = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    cleanups.push(() => reconnect.close());
    const [projectedA, projectedB] = await Promise.all([
      presentation(reconnect, targetA),
      presentation(reconnect, targetB),
    ]);
    const textA = presentationText(projectedA);
    const textB = presentationText(projectedB);
    expect(textA).toContain('answer-a');
    expect(textA).toContain('Target A recovered for later work.');
    expect(textA).not.toContain('answer-b');
    expect(textA).not.toContain('Target B survives target A failure.');
    expect(textB).toContain('answer-b');
    expect(textB).toContain('Target B survives target A failure.');
    expect(textB).not.toContain('answer-a');
    expect(textB).not.toContain('Target A recovered for later work.');

    const [jsonlA, jsonlB] = await Promise.all([
      readFile(workspaceA.session.file, 'utf8'),
      readFile(workspaceB.session.file, 'utf8'),
    ]);
    const entriesA = parseJsonl(jsonlA);
    const entriesB = parseJsonl(jsonlB);
    expect(jsonlA).toContain('answer-a');
    expect(jsonlA).toContain('Concurrent graph marker A');
    expect(jsonlA).toContain('"toolName":"mutate_graph"');
    expect(jsonlA).toContain('"status":"success"');
    expect(jsonlA).toContain(`"specId":${targetA.specId}`);
    expect(withoutWorldUpdates(entriesA)).not.toContain('answer-b');
    expect(withoutWorldUpdates(entriesA)).not.toContain('Concurrent graph marker B');
    expect(worldUpdates(entriesA)).toContain('Concurrent graph marker B');

    expect(jsonlB).toContain('answer-b');
    expect(jsonlB).toContain('Concurrent graph marker B');
    expect(jsonlB).toContain('"toolName":"mutate_graph"');
    expect(jsonlB).toContain('"status":"success"');
    expect(jsonlB).toContain(`"specId":${targetB.specId}`);
    expect(withoutWorldUpdates(entriesB)).not.toContain('answer-a');
    expect(withoutWorldUpdates(entriesB)).not.toContain('Concurrent graph marker A');
    expect(worldUpdates(entriesB)).toContain('Concurrent graph marker A');
    expect(jsonlA).not.toEqual(jsonlB);
  }, 30000);
});
