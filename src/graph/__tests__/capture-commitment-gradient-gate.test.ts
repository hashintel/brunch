import { describe, expect, it } from 'vitest';

import { registerBrunchElicitation } from '../../.pi/extensions/elicitation/index.js';
import { registerBrunchGraph } from '../../.pi/extensions/graph/index.js';
import { registerBrunchReconciliation } from '../../.pi/extensions/reconciliation/index.js';
import { createDb, type BrunchDb } from '../../db/connection.js';
import { changeLog } from '../../db/schema.js';
import {
  CAPTURE_QUALITY_SCENARIOS,
  type CaptureQualityExpectedOutcome,
} from '../../probes/capture-quality-loop.js';
import { CommandExecutor } from '../command-executor.js';
import {
  getElicitationGaps,
  getNodes,
  getOpenReconciliationNeeds,
  latestGraphLsn,
  queryGraph,
  resolveGraphNodeCode,
} from '../queries.js';
import type { NodeKind } from '../schema/nodes.js';

interface RegisteredTool {
  readonly name: string;
  readonly execute: (toolCallId: string, params: never) => Promise<unknown>;
}

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

function registerCaptureTools(db: BrunchDb, specId: number, commandExecutor: CommandExecutor) {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool: (tool: RegisteredTool) => tools.push(tool),
    appendEntry: () => {},
  };

  const reads = {
    queryGraph: () => queryGraph(db, specId),
    getNodes: (selectors: Parameters<typeof getNodes>[2], options?: Parameters<typeof getNodes>[3]) =>
      getNodes(db, specId, selectors, options),
    resolveNodeCode: (code: string) => resolveGraphNodeCode(db, specId, code),
    getElicitationGaps: () => getElicitationGaps(db, specId),
    getOpenReconciliationNeeds: () => getOpenReconciliationNeeds(db, specId),
    latestLsn: () => latestGraphLsn(db, specId),
  };

  registerBrunchGraph(pi as never, { specId, commandExecutor, reads });
  registerBrunchElicitation(pi as never, { specId, commandExecutor, reads });
  registerBrunchReconciliation(pi as never, { specId, commandExecutor, reads });

  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return {
    mutateGraph: byName.get('mutate_graph')!,
    updateGaps: byName.get('update_elicitation_gaps')!,
    updateReconciliationNeeds: byName.get('update_reconciliation_needs')!,
  };
}

async function routeFixedConfidenceTaggedExtraction(options: {
  readonly tools: ReturnType<typeof registerCaptureTools>;
  readonly existingGaps: () => ReturnType<typeof getElicitationGaps>;
}) {
  const explicitCommit = (await options.tools.mutateGraph.execute('explicit-commit', {
    createBasis: 'explicit',
    ops: [
      {
        op: 'create_node',
        ref: 'context',
        plane: 'intent',
        kind: 'context',
        title: 'Brunch is a local spec workspace',
      },
    ],
  } as never)) as { details: { status: string; lsn: number } };

  const implicitCommit = (await options.tools.mutateGraph.execute('implicit-commit', {
    createBasis: 'implicit',
    ops: [
      {
        op: 'create_node',
        ref: 'requirement',
        plane: 'intent',
        kind: 'requirement',
        title: 'Show graph updates live',
      },
      {
        op: 'create_node',
        ref: 'criterion',
        plane: 'intent',
        kind: 'criterion',
        title: 'Observers see the update without refresh',
      },
      {
        op: 'create_edge',
        category: 'rationale',
        support: 'criterion',
        claim: 'requirement',
        stance: 'for',
        rationale: 'The acceptance criterion operationalizes the requirement.',
      },
    ],
  } as never)) as { details: { status: string; lsn: number } };

  await routeLowConfidenceNoticing({
    tools: options.tools,
    existingGaps: options.existingGaps,
    nodeKind: 'assumption',
    question: 'Should observer freshness be treated as a latency promise? ',
    rationale: 'The answer suggested freshness pressure, but did not establish a binding product claim.',
  });
  await routeLowConfidenceNoticing({
    tools: options.tools,
    existingGaps: options.existingGaps,
    nodeKind: 'assumption',
    question: 'Does the demo require a hard latency budget for graph observer freshness?',
    rationale:
      'A second low-confidence noticing maps to the existing assumption gap instead of committing truth.',
  });

  return { explicitCommit, implicitCommit };
}

async function routeLowConfidenceNoticing(options: {
  readonly tools: ReturnType<typeof registerCaptureTools>;
  readonly existingGaps: () => ReturnType<typeof getElicitationGaps>;
  readonly nodeKind: NodeKind;
  readonly question: string;
  readonly rationale: string;
}) {
  const existing = options
    .existingGaps()
    .find((gap) => gap.refersTo === options.nodeKind && gap.predicate.kind === 'presence' && !gap.answered);
  if (existing) return existing.id;

  const spawn = (await options.tools.updateGaps.execute('spawn-gap', {
    action: 'spawn',
    refersTo: options.nodeKind,
    question: options.question,
    rationale: options.rationale,
    band: 'elicitation',
    importance: 2,
  } as never)) as { details: { status: string; id?: number } };
  expect(spawn.details.status).toBe('success');
  return String(spawn.details.id);
}

async function routeScenarioMatrixFact(options: {
  readonly db: BrunchDb;
  readonly specId: number;
  readonly commandExecutor: CommandExecutor;
  readonly tools: ReturnType<typeof registerCaptureTools>;
  readonly ref: string;
  readonly kind: NodeKind;
  readonly title: string;
  readonly expectedOutcome: CaptureQualityExpectedOutcome;
  readonly rationale: string;
}) {
  if (options.expectedOutcome === 'spawn_gap') {
    const beforeNodes = queryGraph(options.db, options.specId, {}, { visibility: 'all' }).nodes.length;
    await routeLowConfidenceNoticing({
      tools: options.tools,
      existingGaps: () => getElicitationGaps(options.db, options.specId),
      nodeKind: options.kind,
      question: `Should capture commit this noticing: ${options.title}?`,
      rationale: options.rationale,
    });
    expect(queryGraph(options.db, options.specId, {}, { visibility: 'all' }).nodes).toHaveLength(beforeNodes);
    return;
  }

  if (options.expectedOutcome === 'reconciliation_need') {
    const first = options.commandExecutor.createNode({
      specId: options.specId,
      plane: 'intent',
      kind: 'constraint',
      title: 'The web observer must remain read-only',
      basis: 'explicit',
    });
    const second = options.commandExecutor.createNode({
      specId: options.specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'The web observer may mutate graph truth',
      basis: 'explicit',
    });
    expect(first.status).toBe('success');
    expect(second.status).toBe('success');
    if (first.status !== 'success' || second.status !== 'success') throw new Error('unreachable');
    const gapIds = getElicitationGaps(options.db, options.specId).map((gap) => gap.id);

    const result = (await options.tools.updateReconciliationNeeds.execute(`recon-${options.ref}`, {
      action: 'create',
      needKind: 'semantic_conflict',
      target: { kind: 'node_pair', aId: first.nodeId, bId: second.nodeId },
      reason: options.rationale,
    } as never)) as { details: { status: string } };

    expect(result.details.status).toBe('success');
    expect(getOpenReconciliationNeeds(options.db, options.specId)).toEqual([
      expect.objectContaining({ kind: 'semantic_conflict' }),
    ]);
    expect(getElicitationGaps(options.db, options.specId).map((gap) => gap.id)).toEqual(gapIds);
    return;
  }

  const createBasis = options.expectedOutcome === 'commit_explicit' ? 'explicit' : 'implicit';
  const result = (await options.tools.mutateGraph.execute(`commit-${options.ref}`, {
    createBasis,
    ops: [
      {
        op: 'create_node',
        ref: options.ref,
        plane: 'intent',
        kind: options.kind,
        title: options.title,
      },
    ],
  } as never)) as { details: { status: string } };

  expect(result.details.status).toBe('success');
  expect(queryGraph(options.db, options.specId, {}, { visibility: 'all' }).nodes).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: options.title, basis: createBasis })]),
  );
}

describe('capture commitment-gradient routing gate', () => {
  it('routes every closed capture-quality scenario class through the commitment gradient', async () => {
    const seenCategories = new Set<string>();

    for (const scenario of CAPTURE_QUALITY_SCENARIOS) {
      const db = createTestDb();
      const commandExecutor = new CommandExecutor(db);
      const created = commandExecutor.createSpec({ name: scenario.label, slug: scenario.id });
      expect(created.status).toBe('success');
      if (created.status !== 'success') throw new Error('unreachable');
      const tools = registerCaptureTools(db, created.specId, commandExecutor);
      seenCategories.add(scenario.category);

      for (const [index, fact] of scenario.expectedFacts.entries()) {
        await routeScenarioMatrixFact({
          db,
          specId: created.specId,
          commandExecutor,
          tools,
          ref: `${fact.kind}-${index}`,
          kind: fact.kind,
          title: fact.title,
          expectedOutcome: fact.expectedOutcome,
          rationale: fact.rationale,
        });
      }
    }

    expect([...seenCategories].sort()).toEqual([
      'contradiction',
      'file_ref',
      'free_prose',
      'implication_heavy',
    ]);
  });

  it('routes fixed high-confidence items to graph truth and low-confidence noticings to exactly one existing-or-new gap', async () => {
    const db = createTestDb();
    const commandExecutor = new CommandExecutor(db);
    const created = commandExecutor.createSpec({ name: 'Capture Gate Spec', slug: 'capture-gate' });
    expect(created.status).toBe('success');
    if (created.status !== 'success') throw new Error('unreachable');
    const tools = registerCaptureTools(db, created.specId, commandExecutor);

    const routed = await routeFixedConfidenceTaggedExtraction({
      tools,
      existingGaps: () => getElicitationGaps(db, created.specId),
    });

    expect(routed.explicitCommit.details.status).toBe('success');
    expect(routed.implicitCommit.details.status).toBe('success');

    const graph = queryGraph(db, created.specId, {}, { visibility: 'all' });
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'context',
          title: 'Brunch is a local spec workspace',
          basis: 'explicit',
        }),
        expect.objectContaining({ kind: 'requirement', title: 'Show graph updates live', basis: 'implicit' }),
        expect.objectContaining({
          kind: 'criterion',
          title: 'Observers see the update without refresh',
          basis: 'implicit',
        }),
      ]),
    );
    expect(graph.edges).toEqual([expect.objectContaining({ category: 'rationale', basis: 'implicit' })]);
    expect(graph.nodes.map((node) => node.title)).not.toContain(
      'Should observer freshness be treated as a latency promise?',
    );

    const gaps = getElicitationGaps(db, created.specId);
    const assumptionGaps = gaps.filter((gap) => gap.refersTo === 'assumption');
    expect(assumptionGaps).toHaveLength(1);
    expect(assumptionGaps[0]).toMatchObject({ answered: false, disposition: 'open' });

    const contextGap = gaps.find((gap) => gap.refersTo === 'context')!;
    expect(contextGap).toMatchObject({ answered: true, disposition: 'answered', coverage: 1 });
  });

  it('routes a fixed contradiction-tagged item to a semantic-conflict reconciliation need, not graph truth or an elicitation gap', async () => {
    const db = createTestDb();
    const commandExecutor = new CommandExecutor(db);
    const created = commandExecutor.createSpec({ name: 'Contradiction Spec', slug: 'contradiction' });
    expect(created.status).toBe('success');
    if (created.status !== 'success') throw new Error('unreachable');
    const tools = registerCaptureTools(db, created.specId, commandExecutor);

    const first = commandExecutor.createNode({
      specId: created.specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'The web observer may mutate graph truth',
      basis: 'explicit',
    });
    const second = commandExecutor.createNode({
      specId: created.specId,
      plane: 'intent',
      kind: 'constraint',
      title: 'The web observer must remain read-only',
      basis: 'explicit',
    });
    expect(first.status).toBe('success');
    expect(second.status).toBe('success');
    if (first.status !== 'success' || second.status !== 'success') throw new Error('unreachable');

    const beforeLsn = latestGraphLsn(db, created.specId);
    const beforeGapIds = getElicitationGaps(db, created.specId).map((gap) => gap.id);
    const contradiction = (await tools.updateReconciliationNeeds.execute('contradiction', {
      action: 'create',
      needKind: 'semantic_conflict',
      target: { kind: 'node_pair', aId: first.nodeId, bId: second.nodeId },
      reason: 'The latest answer conflicts with existing selected-spec graph truth.',
    } as never)) as { details: { status: string; lsn: number } };

    expect(contradiction.details).toMatchObject({ status: 'success', lsn: beforeLsn + 1 });
    expect(getOpenReconciliationNeeds(db, created.specId)).toEqual([
      expect.objectContaining({
        kind: 'semantic_conflict',
        target: { kind: 'node_pair', aId: first.nodeId, bId: second.nodeId },
      }),
    ]);
    expect(getElicitationGaps(db, created.specId).map((gap) => gap.id)).toEqual(beforeGapIds);
    expect(queryGraph(db, created.specId, {}, { visibility: 'all' }).nodes.map((node) => node.title)).toEqual(
      expect.arrayContaining([
        'The web observer may mutate graph truth',
        'The web observer must remain read-only',
      ]),
    );
  });

  it('closes manual gaps on the graph clock and rejects structurally illegal capture batches loudly', async () => {
    const db = createTestDb();
    const commandExecutor = new CommandExecutor(db);
    const created = commandExecutor.createSpec({ name: 'Manual Gap Spec', slug: 'manual-gap' });
    expect(created.status).toBe('success');
    if (created.status !== 'success') throw new Error('unreachable');
    const tools = registerCaptureTools(db, created.specId, commandExecutor);

    const node = (await tools.mutateGraph.execute('manual-gap-node', {
      createBasis: 'explicit',
      ops: [
        {
          op: 'create_node',
          ref: 'constraint',
          plane: 'intent',
          kind: 'constraint',
          title: 'Must run locally',
        },
      ],
    } as never)) as { details: { status: string; createdNodes: Record<string, { code: string }> } };
    expect(node.details.status).toBe('success');

    const manualGap = commandExecutor.createElicitationGap({
      specId: created.specId,
      refersTo: 'constraint',
      question: 'Has locality been confirmed by the user?',
      rationale: 'Manual judgment is needed for this confirmation.',
      band: 'grounding',
      predicate: { kind: 'manual', rubric: 'The user explicitly confirms local-only execution.' },
      importance: 2,
    });
    expect(manualGap.status).toBe('success');
    if (manualGap.status !== 'success') throw new Error('unreachable');

    const beforeCloseLsn = latestGraphLsn(db, created.specId);
    const close = (await tools.updateGaps.execute('close-manual-gap', {
      action: 'set_disposition',
      gapId: String(manualGap.id),
      disposition: 'answered',
      resolvedByNodeCode: node.details.createdNodes.constraint!.code,
    } as never)) as { details: { status: string; lsn: number } };

    expect(close.details).toMatchObject({ status: 'success', lsn: beforeCloseLsn + 1 });
    expect(db.select().from(changeLog).all().at(-1)).toMatchObject({
      spec_id: created.specId,
      lsn: close.details.lsn,
      operation: 'set_elicitation_gap_disposition',
    });

    const illegal = (await tools.mutateGraph.execute('illegal-capture-batch', {
      createBasis: 'explicit',
      ops: [
        { op: 'create_node', ref: 'goal', plane: 'intent', kind: 'goal', title: 'A goal' },
        { op: 'create_edge', category: 'rationale', support: 'goal', claim: 'missing', stance: 'for' },
      ],
    } as never)) as {
      details: { status: string; diagnostics: readonly { field: string; message: string }[] };
    };

    expect(illegal.details.status).toBe('structural_illegal');
    expect(illegal.details.diagnostics.length).toBeGreaterThan(0);
    expect(queryGraph(db, created.specId, { kinds: ['goal'] }, { visibility: 'all' }).nodes).toHaveLength(0);
  });
});
