import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { registerStructuredExchange } from '../../.pi/extensions/exchanges/index.js';
import { changeLog } from '../../db/schema.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import { runCreateOnlyMutation } from '../../graph/__tests__/support/create-only-mutation.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { openWorkspaceDb, openWorkspaceGraphRuntime } from '../../graph/workspace-store.js';
import { createRpcHandlers } from '../../rpc/handlers.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';

const payload = {
  schemaVersion: 1,
  lens: 'intent',
  epistemicStatus: 'asserted',
  grounding: { summary: 'Approve the same persisted review set.', support: ['Transcript'] },
  pitch: { title: 'Approve reviewed graph facts', narrative: 'Creates one reviewed requirement.' },
  entityDrafts: [
    {
      draftId: 'requirement-draft',
      proposedCode: 'REQ1',
      plane: 'intent',
      kind: 'requirement',
      title: 'Reviewed requirement',
      body: 'This exact reviewed node should be accepted.',
    },
  ],
  edgeDrafts: [
    {
      category: 'rationale',
      stance: 'for',
      support: { draftId: 'requirement-draft' },
      claim: { existingCode: 'G1' },
      rationale: 'The reviewed requirement supports the selected-spec goal.',
    },
  ],
} as const;

const exchangeId = 'review-set-convergence';
const projection = projectPresentReviewSet({ exchangeId, payload });

function presentMessage() {
  return {
    role: 'toolResult' as const,
    toolCallId: 'present-review-call',
    toolName: 'present_review_set',
    content: [{ type: 'text' as const, text: '## Approve reviewed graph facts' }],
    details: projection.details,
    isError: false,
    timestamp: 0,
  };
}

function registerAsk(review: { specId: number; commandExecutor: CommandExecutor }) {
  let ask: any;
  registerStructuredExchange(
    {
      registerTool(tool: any) {
        if (tool.name === 'ask') ask = tool;
      },
    } as never,
    { review },
  );
  if (!ask) throw new Error('ask was not registered');
  return ask;
}

function approvePicker() {
  return vi.fn(async (factory: (...args: any[]) => any) => {
    let selected: unknown;
    const component = factory(
      null,
      { fg: (_color: string, text: string) => text },
      null,
      (value: unknown) => {
        selected = value;
      },
    );
    component.handleInput('\r');
    return selected;
  });
}

function normalizedGraph(runtime: Awaited<ReturnType<typeof openWorkspaceGraphRuntime>>, specId: number) {
  const graph = runtime.forSpec(specId).queryGraph();
  const codes = new Map(
    graph.nodes.map((node) => [node.id, `${node.kind.slice(0, 3).toUpperCase()}${node.kindOrdinal}`]),
  );
  return {
    lsn: graph.lsn,
    nodes: graph.nodes.map((node) => ({
      code: codes.get(node.id),
      kind: node.kind,
      title: node.title,
      body: node.body,
      basis: node.basis,
      settlement: node.settlement,
    })),
    edges: graph.edges.map((edge) => ({
      category: edge.category,
      source: codes.get(edge.sourceId),
      target: codes.get(edge.targetId),
      stance: edge.stance,
      rationale: edge.rationale,
      basis: edge.basis,
      settlement: edge.settlement,
    })),
  };
}

async function setupWorkspace(prefix: string) {
  const cwd = await mkdtemp(join(tmpdir(), prefix));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const workspace = await coordinator.createSetupSession({ specTitle: 'Review settlement convergence' });
  const runtime = await openWorkspaceGraphRuntime(cwd);
  const created = runCreateOnlyMutation(runtime.commandExecutor, {
    specId: workspace.spec.id,
    nodes: [{ ref: 'goal', plane: 'intent', kind: 'goal', title: 'Existing selected-spec goal' }],
    edges: [],
  });
  if (created.status !== 'success') throw new Error('failed to create graph fixture');
  return { cwd, coordinator, workspace, runtime };
}

function durableAcceptanceRecord(row: typeof changeLog.$inferSelect) {
  return {
    specId: row.spec_id,
    lsn: row.lsn,
    operation: row.operation,
    payload: JSON.parse(row.payload) as unknown,
  };
}

function terminalFromSession(text: string) {
  type SessionLine = {
    type?: string;
    message?: { details?: { tool_meta?: { curr?: string } }; content?: { text: string }[] };
  };
  return text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionLine)
    .reverse()
    .find((entry) => entry.type === 'message' && entry.message?.details?.tool_meta?.curr === 'request_review')
    ?.message;
}

describe('review-set settlement production-adapter convergence', () => {
  it('converges local registered ask approval and public RPC approval, with duplicate-safe local persistence', async () => {
    const acceptReviewSet = vi.spyOn(CommandExecutor.prototype, 'acceptReviewSet');

    const local = await setupWorkspace('brunch-local-review-convergence-');
    const localDb = await openWorkspaceDb(local.cwd);
    const localBranch: any[] = [{ type: 'message', message: presentMessage() }];
    const ask = registerAsk({
      specId: local.workspace.spec.id,
      commandExecutor: local.runtime.commandExecutor,
    });
    const localBefore = {
      lsn: local.runtime.forSpec(local.workspace.spec.id).latestLsn(),
      logs: localDb.select().from(changeLog).all().length,
    };
    const localTerminal = await ask.execute('ask-approve', { continues: exchangeId }, undefined, undefined, {
      hasUI: true,
      ui: { custom: approvePicker(), input: async () => '' },
      sessionManager: { getBranch: () => localBranch },
    });
    localBranch.push({
      type: 'message',
      message: {
        role: 'toolResult',
        toolCallId: 'ask-approve',
        toolName: 'ask',
        content: localTerminal.content,
        details: localTerminal.details,
        isError: false,
        timestamp: 1,
      },
    });
    const localGraph = normalizedGraph(local.runtime, local.workspace.spec.id);
    const localLogs = localDb.select().from(changeLog).all();
    expect(acceptReviewSet).toHaveBeenCalledTimes(1);
    expect(localGraph.lsn).toBe(localBefore.lsn + 1);
    expect(localLogs).toHaveLength(localBefore.logs + 1);
    expect(durableAcceptanceRecord(localLogs.at(-1)!)).toMatchObject({
      specId: local.workspace.spec.id,
      lsn: localGraph.lsn,
      operation: 'accept_review_set',
      payload: { createBasis: 'explicit' },
    });
    expect(localTerminal.details).toMatchObject({
      tool_meta: { prev: 'present_review_set', curr: 'request_review' },
      answered: { decision: 'approve', receipt: acceptReviewSet.mock.results[0]!.value },
    });
    expect(localTerminal.content[0].text).toContain(`Graph mutated successfully (LSN ${localGraph.lsn}).`);

    const beforeRetry = { graph: localGraph, logs: localLogs };
    const retry = await ask.execute('ask-approve-retry', { continues: exchangeId }, undefined, undefined, {
      hasUI: true,
      ui: { custom: approvePicker(), input: async () => '' },
      sessionManager: { getBranch: () => localBranch },
    });
    expect(retry.details).toMatchObject({
      unavailable: { message: `No pending structured exchange found for ${exchangeId}` },
    });
    expect(acceptReviewSet).toHaveBeenCalledTimes(1);
    expect(normalizedGraph(local.runtime, local.workspace.spec.id)).toEqual(beforeRetry.graph);
    expect(localDb.select().from(changeLog).all()).toEqual(beforeRetry.logs);

    const rpc = await setupWorkspace('brunch-rpc-review-convergence-');
    rpc.workspace.session.manager.appendMessage(presentMessage());
    flushSessionManagerToFile(rpc.workspace.session.manager);
    const rpcDb = await openWorkspaceDb(rpc.cwd);
    const rpcBefore = {
      lsn: rpc.runtime.forSpec(rpc.workspace.spec.id).latestLsn(),
      logs: rpcDb.select().from(changeLog).all().length,
    };
    const response = await createRpcHandlers({ coordinator: rpc.coordinator, cwd: rpc.cwd }).handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'session.submitExchangeResponse',
      params: { exchangeId, answer: { review: { decision: 'approve' } } },
    });
    expect(response).toMatchObject({
      result: { status: 'accepted', review: { status: 'approved', lsn: expect.any(Number) } },
    });
    const rpcGraph = normalizedGraph(rpc.runtime, rpc.workspace.spec.id);
    const rpcLogs = rpcDb.select().from(changeLog).all();
    const rpcTerminal = terminalFromSession(await readFile(rpc.workspace.session.file, 'utf8'));
    if (!rpcTerminal?.content?.[0]) throw new Error('RPC terminal request_review was not persisted');
    expect(acceptReviewSet).toHaveBeenCalledTimes(2);
    expect(rpcGraph.lsn).toBe(rpcBefore.lsn + 1);
    expect(rpcLogs).toHaveLength(rpcBefore.logs + 1);
    expect(durableAcceptanceRecord(rpcLogs.at(-1)!)).toEqual(durableAcceptanceRecord(localLogs.at(-1)!));
    expect(rpcTerminal.details).toMatchObject({
      tool_meta: { prev: 'present_review_set', curr: 'request_review' },
      answered: { decision: 'approve', receipt: acceptReviewSet.mock.results[1]!.value },
    });
    expect(rpcTerminal.content[0].text).toContain(`Graph mutated successfully (LSN ${rpcGraph.lsn}).`);

    expect({ ...localGraph, lsn: 0 }).toEqual({ ...rpcGraph, lsn: 0 });
  });
});
