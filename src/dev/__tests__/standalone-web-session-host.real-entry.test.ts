import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { afterAll, describe, expect, it } from 'vitest';
import WebSocket, { type RawData } from 'ws';

import { runBrunchWeb } from '../../app/brunch-web.js';
import type { SessionPresentationResult } from '../../projections/session/session-presentation.js';
import { LIVE_SESSION_EVENT_METHOD, liveSessionEventSchema } from '../../rpc/live-session-contract.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { registerKeptFauxProvider, RpcSocket, waitFor } from './web-driver-streaming-support.js';

const question = 'What proves the browser answer path?';

async function waitForPresentationText(
  rpc: RpcSocket,
  target: { readonly specId: number; readonly sessionId: string },
  text: string,
  label: string,
): Promise<void> {
  await waitFor(
    async () => {
      const result = (await rpc.request('session.presentation', target)) as SessionPresentationResult;
      return (
        result.status === 'ready' &&
        result.presentation.entries.some(
          (entry) => entry.kind === 'message' && entry.role === 'assistant' && entry.text.includes(text),
        )
      );
    },
    8000,
    label,
  );
}

function websocketMessageToString(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString('utf8');
  }
  return Buffer.from(data).toString('utf8');
}

describe('standalone web session host production entry', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  });

  it('rehydrates a settled candidate offer and request-choice continuation after reconnect', async () => {
    const faux = registerKeptFauxProvider('standalone-web-candidates', 'Standalone opening turn.');
    cleanups.push(() => faux.provider.unregister());
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-standalone-web-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({ specTitle: 'Standalone web proof' });
    const target = { specId: workspace.spec.id, sessionId: workspace.session.id };
    const host = await runBrunchWeb({ cwd, coordinator, agentServices: faux.agentServices });
    cleanups.push(() => host.close());
    const rpcUrl = `${host.url.replace(/^http/u, 'ws')}/rpc`;
    const rpc = await RpcSocket.open(rpcUrl);
    cleanups.push(() => rpc.close());
    const observer = new WebSocket(rpcUrl);
    await new Promise<void>((resolve, reject) => {
      observer.once('open', resolve);
      observer.once('error', reject);
    });
    cleanups.push(() => observer.close());
    const liveFrames: unknown[] = [];
    observer.on('message', (data) => {
      const frame = JSON.parse(websocketMessageToString(data)) as {
        method?: string;
        params?: unknown;
      };
      if (frame.method === LIVE_SESSION_EVENT_METHOD) liveFrames.push(frame.params);
    });

    await expect(rpc.request('session.open', target)).resolves.toMatchObject({ status: 'opened' });
    await waitForPresentationText(rpc, target, 'Standalone opening turn.', 'startup turn to settle');
    faux.provider.appendResponses([
      () =>
        fauxAssistantMessage(
          [
            fauxToolCall(
              'present_candidates',
              {
                exchangeId: 'web-candidates',
                heading: question,
                body: 'Compare the proposals.',
                candidates: [
                  {
                    id: 'semantic-projection',
                    title: 'Shared semantic projection',
                    user_rubric: {
                      core_bet: 'Decode once before rendering.',
                      best_fit: 'Web and TUI parity.',
                      cost_complexity: 'One shared projection.',
                      covers_well: 'Durable presentation semantics.',
                      main_risks: 'Adapter drift.',
                      lock_in_constraints: 'Transport-neutral entries.',
                      recommendation: 'Use the shared projection.',
                    },
                    meta_rubric: { commitment: 'Preserve D128-L.' },
                    graph_refs: [],
                  },
                ],
              },
              { id: 'web-candidates-call' },
            ),
            fauxToolCall('ask', { continues: 'web-candidates' }, { id: 'web-candidates-ask-call' }),
          ],
          { stopReason: 'toolUse' },
        ),
      () => fauxAssistantMessage('Durable candidate answer complete.'),
    ]);

    const turn = rpc.request('session.driveTurn', {
      ...target,
      driverId: 'browser-candidates-proof',
      prompt: 'Run the deterministic candidate choice.',
    });
    await waitFor(asyncOpenAsk, 8000, 'open candidate ask');
    async function asyncOpenAsk(): Promise<boolean> {
      const result = (await rpc.request('session.openAsks', target)) as { openAsks: unknown[] };
      return result.openAsks.length === 1;
    }
    await expect(
      rpc.request('session.answerExchange', {
        ...target,
        driverId: 'browser-candidates-proof',
        exchangeId: 'web-candidates',
        answer: 'semantic-projection',
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    await expect(turn).resolves.toMatchObject({ status: 'completed' });

    rpc.close();
    const reconnected = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    cleanups.push(() => reconnected.close());
    const projected = (await reconnected.request(
      'session.presentation',
      target,
    )) as SessionPresentationResult;
    expect(projected).toMatchObject({ status: 'ready' });
    if (projected.status !== 'ready') return;
    expect(projected.presentation.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'present_candidates',
          exchangeId: 'web-candidates',
          candidates: [expect.objectContaining({ id: 'semantic-projection' })],
          continuation: expect.objectContaining({
            request: 'request_choice',
            exchangeId: 'web-candidates',
          }),
        }),
        expect.objectContaining({
          kind: 'ask',
          exchangeId: 'web-candidates',
          terminal: {
            status: 'answered',
            value: expect.objectContaining({
              choice: { id: 'semantic-projection', label: 'Shared semantic projection', kind: 'listed' },
            }),
          },
        }),
        expect.objectContaining({
          kind: 'message',
          role: 'assistant',
          text: 'Durable candidate answer complete.',
        }),
      ]),
    );

    expect(liveFrames.length).toBeGreaterThan(0);
    expect(liveFrames.map((frame) => liveSessionEventSchema.parse(frame))).toEqual(
      expect.arrayContaining([expect.objectContaining({ target, seq: 0 })]),
    );

    const reopenedFrameBoundary = liveFrames.length;
    await expect(reconnected.request('session.close', target)).resolves.toMatchObject({ status: 'closed' });
    await expect(reconnected.request('session.open', target)).resolves.toMatchObject({ status: 'opened' });
    faux.provider.appendResponses([() => fauxAssistantMessage('Second open epoch complete.')]);
    await expect(
      reconnected.request('session.driveTurn', {
        ...target,
        driverId: 'browser-reopen-proof',
        prompt: 'Prove the reopened stream.',
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    await waitFor(() => liveFrames.slice(reopenedFrameBoundary).length > 0, 8000, 'reopened semantic frame');
    const parsedFrames = liveFrames.map((frame) => liveSessionEventSchema.parse(frame));
    const reopenedFrames = parsedFrames.slice(reopenedFrameBoundary);
    expect(reopenedFrames.map((event) => event.seq)).toEqual(reopenedFrames.map((_, index) => index));
  });

  it('approves one review set, commits once, settles, and rehydrates its receipt after reconnect', async () => {
    const faux = registerKeptFauxProvider('standalone-web-review-set', 'Standalone opening turn.');
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
    await waitForPresentationText(rpc, target, 'Standalone opening turn.', 'startup turn to settle');
    faux.provider.appendResponses([
      () =>
        fauxAssistantMessage(
          [
            fauxToolCall(
              'present_review_set',
              {
                exchangeId: 'web-review-set',
                payload: {
                  schemaVersion: 1,
                  lens: 'intent',
                  epistemicStatus: 'asserted',
                  grounding: { summary: 'Approve one cohesive requirement.', support: ['User request'] },
                  pitch: { title: 'Approve reviewed requirement', narrative: 'Commit this exact set once.' },
                  entityDrafts: [
                    { draftId: 'goal-draft', plane: 'intent', kind: 'goal', title: 'Reliable approval' },
                    {
                      draftId: 'requirement-draft',
                      plane: 'intent',
                      kind: 'requirement',
                      title: 'Atomic approval',
                      body: 'The reviewed set commits once.',
                    },
                  ],
                  edgeDrafts: [
                    {
                      category: 'rationale',
                      stance: 'for',
                      support: { draftId: 'requirement-draft' },
                      claim: { draftId: 'goal-draft' },
                      rationale: 'The requirement supports the selected-spec goal.',
                    },
                  ],
                },
              },
              { id: 'web-review-set-call' },
            ),
            fauxToolCall('ask', { continues: 'web-review-set' }, { id: 'web-review-set-ask-call' }),
          ],
          { stopReason: 'toolUse' },
        ),
      () => fauxAssistantMessage('Durable review approval complete.'),
    ]);

    const turn = rpc.request('session.driveTurn', {
      ...target,
      driverId: 'browser-review-proof',
      prompt: 'Run the deterministic review.',
    });
    await waitFor(
      async () =>
        ((await rpc.request('session.openAsks', target)) as { openAsks: unknown[] }).openAsks.length === 1,
      8000,
      'open review ask',
    );
    await expect(
      rpc.request('session.answerExchange', {
        ...target,
        driverId: 'browser-review-proof',
        exchangeId: 'web-review-set',
        answer: 'approve',
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    await expect(turn).resolves.toMatchObject({ status: 'completed' });

    rpc.close();
    const reconnected = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    cleanups.push(() => reconnected.close());
    const projected = (await reconnected.request(
      'session.presentation',
      target,
    )) as SessionPresentationResult;
    expect(projected).toMatchObject({ status: 'ready' });
    if (projected.status !== 'ready') return;
    const offer = projected.presentation.entries.find((entry) => entry.kind === 'present_review_set');
    const terminal = projected.presentation.entries.find(
      (entry) => entry.kind === 'ask' && entry.exchangeId === 'web-review-set',
    );
    expect(offer).toMatchObject({
      kind: 'present_review_set',
      exchangeId: 'web-review-set',
      reviewSet: {
        nodes: [
          { draft_id: 'goal-draft', proposed_code: 'G1', title: 'Reliable approval' },
          { draft_id: 'requirement-draft', proposed_code: 'REQ1', title: 'Atomic approval' },
        ],
        edges: [expect.objectContaining({ category: 'rationale' })],
      },
      continuation: { tool: 'ask' },
    });
    expect(terminal).toMatchObject({
      kind: 'ask',
      terminal: {
        status: 'answered',
        value: {
          decision: 'approve',
          receipt: {
            status: 'success',
            lsn: expect.any(Number),
            createdNodes: { 'requirement-draft': { code: 'REQ1' } },
          },
        },
      },
    });
  });

  it('rehydrates a settled digest offer and feedback continuation after reconnect', async () => {
    const faux = registerKeptFauxProvider('standalone-web-digest', 'Standalone opening turn.');
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
    await waitForPresentationText(rpc, target, 'Standalone opening turn.', 'startup turn to settle');
    faux.provider.appendResponses([
      () =>
        fauxAssistantMessage(
          [
            fauxToolCall(
              'present_digest',
              {
                exchangeId: 'web-digest',
                heading: question,
                body: 'Confirm before capture.',
                digest: {
                  abstract: 'The browser and reconnect share one semantic digest.',
                  recommendation: 'Keep settlement authoritative.',
                },
              },
              { id: 'web-digest-call' },
            ),
            fauxToolCall('ask', { continues: 'web-digest' }, { id: 'web-ask-call' }),
          ],
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
      const result = (await rpc.request('session.openAsks', target)) as { openAsks: unknown[] };
      return result.openAsks.length === 1;
    }
    await expect(
      rpc.request('session.answerExchange', {
        ...target,
        driverId: 'browser-proof',
        exchangeId: 'web-digest',
        answer: 'Clarify the source boundary.',
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    await expect(turn).resolves.toMatchObject({ status: 'completed' });

    rpc.close();
    const reconnected = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    cleanups.push(() => reconnected.close());
    const projected = (await reconnected.request(
      'session.presentation',
      target,
    )) as SessionPresentationResult;
    expect(projected).toMatchObject({ status: 'ready' });
    if (projected.status !== 'ready') return;
    expect(projected.presentation.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'present_digest',
          exchangeId: 'web-digest',
          digest: expect.objectContaining({
            abstract: 'The browser and reconnect share one semantic digest.',
            recommendation: 'Keep settlement authoritative.',
          }),
          continuation: expect.objectContaining({ tool: 'ask' }),
        }),
        expect.objectContaining({
          kind: 'ask',
          exchangeId: 'web-digest',
          terminal: {
            status: 'answered',
            value: expect.objectContaining({ text: 'Clarify the source boundary.' }),
          },
        }),
        expect.objectContaining({ kind: 'message', role: 'assistant', text: 'Durable answer complete.' }),
      ]),
    );
  });
});
