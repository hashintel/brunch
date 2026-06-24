import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import {
  getElicitationGaps,
  getNodes,
  getOpenReconciliationNeeds,
  latestGraphLsn,
  queryGraph,
  resolveGraphNodeCode,
  type GraphFilter,
  type GraphVisibility,
} from '../../graph/queries.js';
import { formatGraphOverview } from '../../renderers/graph/graph-slice.js';
import { translateMutateGraph, formatMutateGraphResult } from '../extensions/graph/command-adapter.js';
import { registerBrunchGraph, type GraphReaders } from '../extensions/graph/index.js';
import { ReadGraphParams } from '../extensions/graph/tool-schemas.js';

let nextSpecSlug = 0;

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

function seedSpec(db: BrunchDb): number {
  const result = new CommandExecutor(db).createSpec({ name: 'Test Spec', slug: `test-${nextSpecSlug++}` });
  if (result.status !== 'success') throw new Error('Unable to create test spec');
  return result.specId;
}

function createGraphReads(db: BrunchDb, specId: number): GraphReaders {
  return {
    queryGraph: (filter?: GraphFilter, options?: { visibility?: GraphVisibility }) =>
      queryGraph(db, specId, filter, options),
    getNodes: (selectors, options) => getNodes(db, specId, selectors, options),
    resolveNodeCode: (code) => resolveGraphNodeCode(db, specId, code),
    getElicitationGaps: () => getElicitationGaps(db, specId),
    getOpenReconciliationNeeds: () => getOpenReconciliationNeeds(db, specId),
    latestLsn: () => latestGraphLsn(db, specId),
  };
}

describe('graph tool adapter', () => {
  it('teaches read_graph mode companions at the schema boundary', () => {
    expect(Value.Check(ReadGraphParams, { mode: 'overview' })).toBe(true);
    expect(Value.Check(ReadGraphParams, { mode: 'neighborhood', nodeCode: 'G1' })).toBe(true);
    expect(Value.Check(ReadGraphParams, { mode: 'neighborhood' })).toBe(false);
    expect(Value.Check(ReadGraphParams, { mode: 'neighborhood', nodeCode: '' })).toBe(false);
    expect(
      Value.Check(ReadGraphParams, { mode: 'related', anchorCodes: ['G1'], edgeCategory: 'dependency' }),
    ).toBe(true);
    expect(Value.Check(ReadGraphParams, { mode: 'related', edgeCategory: 'dependency' })).toBe(false);
    expect(
      Value.Check(ReadGraphParams, { mode: 'related', anchorCodes: [], edgeCategory: 'dependency' }),
    ).toBe(false);
    expect(Value.Check(ReadGraphParams, { mode: 'related', anchorCodes: ['G1'] })).toBe(false);

    // List modes deliberately keep their filter-empty behavior separate from malformed companion calls.
    expect(Value.Check(ReadGraphParams, { mode: 'list_by_kind' })).toBe(true);
    expect(Value.Check(ReadGraphParams, { mode: 'list_by_band', readinessBands: [] })).toBe(true);
  });

  it('translates existing projected codes before handing edges to CommandExecutor', () => {
    const input = translateMutateGraph(
      {
        ops: [
          { op: 'create_node', ref: 'n1', plane: 'intent', kind: 'goal', title: 'Test goal' },
          {
            op: 'create_edge',
            category: 'rationale',
            support: { existingCode: 'G1' },
            claim: 'n1',
            stance: 'for',
          },
        ],
      },
      7,
      (code) => (code === 'G1' ? 42 : undefined),
    );

    expect('status' in input).toBe(false);
    if ('status' in input) throw new Error('unreachable');
    expect(input.ops[1]).toMatchObject({
      op: 'create_edge',
      category: 'rationale',
      support: { existing: 42 },
      claim: 'n1',
      stance: 'for',
    });
  });

  it('formats graph slices for LLM-facing tool content', () => {
    expect(formatGraphOverview({ nodes: [], edges: [], lsn: 0 })).toContain('empty');
  });
});

describe('graph tools end-to-end', () => {
  it('mutate_graph creates nodes and read_graph overview reads the selected-spec slice', async () => {
    const db = createTestDb();
    const executor = new CommandExecutor(db);
    const specId = seedSpec(db);
    const reads = createGraphReads(db, specId);
    const tools: Array<{ name: string; execute: (toolCallId: string, params: never) => Promise<unknown> }> =
      [];
    const carriers: Array<{ customType: string; data: unknown }> = [];

    registerBrunchGraph(
      {
        registerTool: (tool: unknown) => tools.push(tool as never),
        appendEntry(customType: string, data: unknown) {
          carriers.push({ customType, data });
        },
      } as never,
      {
        specId,
        commandExecutor: executor,
        reads,
      },
    );

    const commit = tools.find((tool) => tool.name === 'mutate_graph')!;
    const read = tools.find((tool) => tool.name === 'read_graph')!;

    const commitResult = (await commit.execute('tool-1', {
      ops: [
        { op: 'create_node', ref: 'n1', plane: 'intent', kind: 'goal', title: 'Build graph API' },
        { op: 'create_node', ref: 'n2', plane: 'intent', kind: 'requirement', title: 'Expose queryGraph' },
        { op: 'create_node', ref: 'n3', plane: 'intent', kind: 'constraint', title: 'Keep local-only' },
        { op: 'create_edge', category: 'dependency', dependency: 'n2', dependent: 'n1' },
      ],
    } as never)) as {
      content: readonly { text: string }[];
      details: { status: string; lsn: number };
    };

    expect(commitResult.details.status).toBe('success');
    expect(formatMutateGraphResult(commitResult.details as never)).toContain('Graph mutated successfully');
    expect(carriers).toEqual([
      {
        customType: 'brunch.own_mutation',
        data: { specId, lsn: commitResult.details.lsn, source: 'mutate_graph' },
      },
    ]);

    const readResult = (await read.execute('tool-2', { mode: 'overview' } as never)) as {
      content: readonly { text: string }[];
      details: { nodes: readonly unknown[]; edges: readonly unknown[]; lsn: number };
    };

    expect(readResult.details.nodes).toHaveLength(3);
    expect(readResult.details.edges).toHaveLength(1);
    expect(readResult.content[0]!.text).toContain('Build graph API');
    expect(carriers.at(-1)).toEqual({
      customType: 'brunch.graph_overview_snapshot',
      data: { specId, snapshotLsn: readResult.details.lsn },
    });

    const bandResult = (await read.execute('tool-3', {
      mode: 'list_by_band',
      readinessBands: ['elicitation'],
    } as never)) as { content: readonly { text: string }[] };
    expect(bandResult.content[0]!.text).toContain('nodes — intent · elicitation (1)');
    expect(bandResult.content[0]!.text).not.toContain('nodes — intent · grounding (1)');

    await read.execute('tool-4', { mode: 'neighborhood', nodeCode: 'G1' } as never);
    expect(carriers).toHaveLength(2);
  });

  it('fails loud when mode-specific read_graph companions are malformed', async () => {
    const db = createTestDb();
    const executor = new CommandExecutor(db);
    const specId = seedSpec(db);
    const reads = createGraphReads(db, specId);
    const tools: Array<{ name: string; execute: (toolCallId: string, params: never) => Promise<unknown> }> =
      [];

    registerBrunchGraph({ registerTool: (tool: unknown) => tools.push(tool as never) } as never, {
      specId,
      commandExecutor: executor,
      reads,
    });

    const read = tools.find((tool) => tool.name === 'read_graph')!;
    const missingNode = (await read.execute('tool-1', { mode: 'neighborhood' } as never)) as {
      content: readonly { text: string }[];
      details: { status: string; diagnostics: readonly { field: string; message: string }[] };
    };
    expect(missingNode.details).toEqual({
      status: 'structural_illegal',
      diagnostics: [{ field: 'nodeCode', message: 'non-empty nodeCode is required for neighborhood mode' }],
    });
    expect(missingNode.content[0]!.text).toContain('STRUCTURAL_ILLEGAL');

    const missingAnchors = (await read.execute('tool-2', {
      mode: 'related',
      anchorCodes: [],
      edgeCategory: 'dependency',
    } as never)) as typeof missingNode;
    expect(missingAnchors.details).toEqual({
      status: 'structural_illegal',
      diagnostics: [{ field: 'anchorCodes', message: 'related mode requires non-empty anchorCodes' }],
    });
  });
});
