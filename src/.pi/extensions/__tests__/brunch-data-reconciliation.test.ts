import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema.js';
import {
  CommandExecutor,
  getOpenReconciliationNeeds,
  type ReconciliationNeed,
} from '../../../graph/index.js';
import {
  activeToolNamesForBrunchAgentState,
  projectBrunchAgentState,
} from '../agent-runtime/runtime/index.js';
import {
  READ_RECONCILIATION_NEEDS_TOOL,
  registerBrunchReconciliation,
  UPDATE_RECONCILIATION_NEEDS_TOOL,
} from '../brunch-data/reconciliation/index.js';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details: Record<string, unknown>;
}

function collectTools(deps: Parameters<typeof registerBrunchReconciliation>[1]) {
  const tools = new Map<string, { execute: (...args: never[]) => Promise<unknown> }>();
  registerBrunchReconciliation(
    {
      registerTool(tool: { name: string; execute: (...args: never[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never,
    deps,
  );
  return tools;
}

function harness() {
  const db = createDb(':memory:');
  const executor = new CommandExecutor(db);
  const spec = executor.createSpec({ name: 'Recon spec', slug: 'recon-spec' });
  if (spec.status !== 'success') throw new Error('spec creation failed');
  const specId = spec.specId;
  const first = executor.createNode({
    specId,
    plane: 'intent',
    kind: 'requirement',
    title: 'Existing truth',
  });
  const second = executor.createNode({
    specId,
    plane: 'intent',
    kind: 'constraint',
    title: 'Conflicting answer',
  });
  if (first.status !== 'success' || second.status !== 'success') throw new Error('node creation failed');

  const tools = collectTools({
    specId,
    commandExecutor: executor,
    reads: { getOpenReconciliationNeeds: (id: number) => getOpenReconciliationNeeds(db, id) },
  });
  const call = async (toolName: string, params: Record<string, unknown>) =>
    (await tools.get(toolName)!.execute('call-1' as never, params as never)) as ToolResult;

  return { db, executor, specId, firstNodeId: first.nodeId, secondNodeId: second.nodeId, tools, call };
}

describe('reconciliation register tools', () => {
  it('registers read and update tools under canonical names', () => {
    const tools = collectTools({
      specId: 1,
      commandExecutor: {} as never,
      reads: { getOpenReconciliationNeeds: () => [] },
    });

    expect([...tools.keys()]).toEqual([READ_RECONCILIATION_NEEDS_TOOL, UPDATE_RECONCILIATION_NEEDS_TOOL]);
  });

  it('creates a semantic-conflict node-pair need through CommandExecutor and reads the open agenda', async () => {
    const { db, specId, firstNodeId, secondNodeId, call } = harness();
    const beforeLsn = db
      .select({ lsn: schema.graphClock.lsn })
      .from(schema.graphClock)
      .where(eq(schema.graphClock.spec_id, specId))
      .get()!.lsn;

    const created = await call(UPDATE_RECONCILIATION_NEEDS_TOOL, {
      action: 'create',
      needKind: 'semantic_conflict',
      target: { kind: 'node_pair', aId: firstNodeId, bId: secondNodeId },
      reason: 'The answer contradicts existing graph truth.',
    });

    expect(created.details).toMatchObject({ status: 'success', lsn: beforeLsn + 1 });
    expect(
      db
        .select({ operation: schema.changeLog.operation })
        .from(schema.changeLog)
        .all()
        .map((row) => row.operation),
    ).toContain('create_reconciliation_need');

    const read = await call(READ_RECONCILIATION_NEEDS_TOOL, {});
    const needs = (read.details as { needs: readonly ReconciliationNeed[] }).needs;
    expect(needs).toEqual([
      expect.objectContaining({
        kind: 'semantic_conflict',
        target: { kind: 'node_pair', aId: firstNodeId, bId: secondNodeId },
        rationale: 'The answer contradicts existing graph truth.',
      }),
    ]);
    expect(read.content[0]!.text).toContain('semantic_conflict');
  });

  it('surfaces structural diagnostics for missing or cross-spec targets with no partial write', async () => {
    const { db, specId, call } = harness();

    const illegal = await call(UPDATE_RECONCILIATION_NEEDS_TOOL, {
      action: 'create',
      needKind: 'semantic_conflict',
      target: { kind: 'node_pair', aId: 9999, bId: 10000 },
    });

    expect(illegal.content[0]!.text).toContain('STRUCTURAL_ILLEGAL');
    expect(illegal.details).toMatchObject({ status: 'structural_illegal' });
    const read = await call(READ_RECONCILIATION_NEEDS_TOOL, {});
    expect((read.details as { needs: readonly ReconciliationNeed[] }).needs).toEqual([]);
    expect(getOpenReconciliationNeeds(db, specId)).toEqual([]);
  });

  it('resolves an open need through CommandExecutor and clears it from the agenda', async () => {
    const { db, specId, firstNodeId, secondNodeId, call } = harness();
    await call(UPDATE_RECONCILIATION_NEEDS_TOOL, {
      action: 'create',
      needKind: 'semantic_conflict',
      target: { kind: 'node_pair', aId: firstNodeId, bId: secondNodeId },
    });
    const open = getOpenReconciliationNeeds(db, specId);
    expect(open).toHaveLength(1);
    const lsnBeforeResolve = db
      .select({ lsn: schema.graphClock.lsn })
      .from(schema.graphClock)
      .where(eq(schema.graphClock.spec_id, specId))
      .get()!.lsn;

    const resolved = await call(UPDATE_RECONCILIATION_NEEDS_TOOL, { action: 'resolve', needId: open[0]!.id });

    expect(resolved.details).toMatchObject({ status: 'success', lsn: lsnBeforeResolve + 1 });
    expect(resolved.content[0]!.text).toContain('Resolved reconciliation need');
    expect(getOpenReconciliationNeeds(db, specId)).toEqual([]);
  });

  it('rejects resolving an unknown or unparseable need id with no write', async () => {
    const { db, specId, call } = harness();

    const unknown = await call(UPDATE_RECONCILIATION_NEEDS_TOOL, { action: 'resolve', needId: '4242' });
    expect(unknown.details).toMatchObject({ status: 'structural_illegal' });

    const unparseable = await call(UPDATE_RECONCILIATION_NEEDS_TOOL, {
      action: 'resolve',
      needId: 'not-an-id',
    });
    expect(unparseable.content[0]!.text).toContain('STRUCTURAL_ILLEGAL');
    expect(unparseable.details).toMatchObject({ status: 'structural_illegal' });

    expect(getOpenReconciliationNeeds(db, specId)).toEqual([]);
  });

  it('proves both recon-need tools are active in Specify posture alongside update_elicitation_scratchpad', () => {
    const state = projectBrunchAgentState([]);
    const active = activeToolNamesForBrunchAgentState(
      {
        getAllTools: () => [
          { name: 'read_reconciliation_needs' },
          { name: 'update_reconciliation_needs' },
          { name: 'update_elicitation_scratchpad' },
        ],
      } as never,
      state,
    );

    expect(active).toEqual([
      READ_RECONCILIATION_NEEDS_TOOL,
      UPDATE_RECONCILIATION_NEEDS_TOOL,
      'update_elicitation_scratchpad',
    ]);
  });
});
