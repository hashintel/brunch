/**
 * Graph tool integration tests.
 *
 * Tests the commit_graph and read_graph tools end-to-end through
 * the command adapter → CommandExecutor → graph read chain.
 *
 * SPEC: D4-L, D20-L, D52-L, D53-L, I26-L, I34-L, A14-L
 */

import { Value } from 'typebox/value';
import { describe, beforeEach, it, expect } from 'vitest';

import { createDb } from '../../db/connection.js';
import type { BrunchDb } from '../../db/connection.js';
import { edges } from '../../db/schema.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import {
  getGraphGaps,
  getGraphOverview,
  getGraphSliceByKinds,
  getGraphSliceByReadinessBands,
  getNodeNeighborhood,
  getRelatedNodes,
  resolveGraphNodeCode,
} from '../../graph/queries.js';
import { createProductUpdatePublisher } from '../../rpc/product-updates.js';
import {
  translateCommitGraph,
  formatCommitGraphResult,
  formatGraphOverview,
  formatNeighborhoodResult,
  formatRelatedNodesResult,
} from '../extensions/graph/command-adapter.js';
import { registerBrunchGraph, type GraphReaders } from '../extensions/graph/index.js';
import { CommitGraphParams, ReadGraphParams } from '../extensions/graph/tool-schemas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let nextSpecSlug = 0;

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}
function seedSpec(db: BrunchDb): number {
  const result = new CommandExecutor(db).createSpec({
    name: 'Test Spec',
    slug: `test-${nextSpecSlug++}`,
  });
  if (result.status !== 'success') throw new Error('Unable to create test spec');
  return result.specId;
}

function createGraphReads(db: BrunchDb, specId: number): GraphReaders {
  return {
    getGraphOverview: (options) => getGraphOverview(db, specId, options),
    getGraphSliceByKinds: (options) => getGraphSliceByKinds(db, specId, options),
    getGraphSliceByReadinessBands: (options) => getGraphSliceByReadinessBands(db, specId, options),
    getGraphGaps: (options) => getGraphGaps(db, specId, options),
    getRelatedNodes: (options) => getRelatedNodes(db, specId, options),
    getNodeNeighborhood: (nodeId, options) => getNodeNeighborhood(db, specId, nodeId, options),
    resolveNodeCode: (code) => resolveGraphNodeCode(db, specId, code),
  };
}

// ---------------------------------------------------------------------------
// command-adapter: translateCommitGraph
// ---------------------------------------------------------------------------

describe('translateCommitGraph', () => {
  it('resolves existing projected codes before handing edges to CommandExecutor', () => {
    const input = translateCommitGraph(
      {
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Test goal' },
          {
            ref: 'n2',
            plane: 'intent',
            kind: 'requirement',
            title: 'Test req',
            body: 'details',
          },
        ],
        edges: [
          { category: 'dependency', source: 'n2', target: 'n1' },
          {
            category: 'support',
            source: { existingCode: 'G1' },
            target: 'n1',
            stance: 'for',
          },
        ],
      },
      7,
      (code) => (code === 'G1' ? 42 : undefined),
    );

    expect('status' in input).toBe(false);
    if ('status' in input) throw new Error('unreachable');
    expect(input.specId).toBe(7);
    expect(input.nodes).toHaveLength(2);
    expect(input.nodes[0]!.ref).toBe('n1');
    expect(input.edges).toHaveLength(2);
    expect(input.edges[0]!.source).toBe('n2');
    expect(input.edges[1]!.source).toEqual({ existing: 42 });
    expect(input.basis).toBe('implicit');
    expect(input.nodes[0]).not.toHaveProperty('basis');
    expect(input.edges[0]).not.toHaveProperty('basis');
  });
  it('normalizes projected-code failures into structured diagnostics', () => {
    expect(
      translateCommitGraph(
        {
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'Test goal' }],
          edges: [{ category: 'dependency', source: { existingCode: 'bad' }, target: 'n1' }],
        },
        7,
        () => undefined,
      ),
    ).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edges[0].source' }],
    });

    expect(
      translateCommitGraph(
        {
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'Test goal' }],
          edges: [{ category: 'dependency', source: { existingCode: 'G99' }, target: 'n1' }],
        },
        7,
        () => undefined,
      ),
    ).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edges[0].source' }],
    });
  });
});

describe('graph tool schemas', () => {
  it('accepts existing-node projected codes but not raw existing node ids', () => {
    const valid = {
      nodes: [],
      edges: [{ category: 'dependency', source: { existingCode: 'G1' }, target: 'n1' }],
    };
    const rawId = {
      nodes: [],
      edges: [{ category: 'dependency', source: { existing: 1 }, target: 'n1' }],
    };

    expect(Value.Check(CommitGraphParams, valid)).toBe(true);
    expect(Value.Check(CommitGraphParams, rawId)).toBe(false);
  });

  it('accepts projected node codes for read_graph neighborhood mode instead of node_id', () => {
    expect(Value.Check(ReadGraphParams, { mode: 'neighborhood', nodeCode: 'G1' })).toBe(true);
    expect(Value.Check(ReadGraphParams, { mode: 'neighborhood', node_id: 1 })).toBe(false);
  });

  it('accepts list read modes with projection-aware kind or readiness filters', () => {
    expect(
      Value.Check(ReadGraphParams, {
        mode: 'list_by_kind',
        kinds: ['goal', 'requirement'],
        projection: 'graph_truth',
      }),
    ).toBe(true);
    expect(
      Value.Check(ReadGraphParams, {
        mode: 'list_by_band',
        readinessBands: ['grounding', 'elicitation'],
      }),
    ).toBe(true);
  });

  it('accepts related mode with anchor codes, category, direction, and hops', () => {
    expect(
      Value.Check(ReadGraphParams, {
        mode: 'related',
        anchorCodes: ['R1'],
        edgeCategory: 'dependency',
        direction: 'outgoing',
        hops: 2,
      }),
    ).toBe(true);
  });

  it('accepts gaps mode with a base filter and absent edge category', () => {
    expect(
      Value.Check(ReadGraphParams, {
        mode: 'gaps',
        kinds: ['thesis'],
        absentEdgeCategory: 'proof',
        direction: 'incoming',
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// command-adapter: formatCommitGraphResult
// ---------------------------------------------------------------------------

describe('formatCommitGraphResult', () => {
  it('formats success with node refs, projected node codes, and edge ids', () => {
    const text = formatCommitGraphResult({
      status: 'success',
      lsn: 5,
      createdNodes: { n1: { id: 1, code: 'G1' }, n2: { id: 2, code: 'R1' } },
      edges: [10, 11],
    });

    expect(text).toContain('Graph committed successfully');
    expect(text).toContain('LSN 5');
    expect(text).toContain('n1 → G1');
    expect(text).not.toContain('n1 → #1');
    expect(text).toContain('#10');
  });

  it('formats structural_illegal with diagnostics', () => {
    const text = formatCommitGraphResult({
      status: 'structural_illegal',
      diagnostics: [
        { field: 'nodes[0].kind', message: '"invalid" is not a valid kind' },
        { field: 'edges[0].stance', message: 'stance required for proof' },
      ],
    });

    expect(text).toContain('STRUCTURAL_ILLEGAL');
    expect(text).toContain('nodes[0].kind');
    expect(text).toContain('edges[0].stance');
  });
});

// ---------------------------------------------------------------------------
// command-adapter: formatGraphOverview
// ---------------------------------------------------------------------------

describe('formatGraphOverview', () => {
  it('reports empty graph', () => {
    const text = formatGraphOverview({
      nodes: [],
      edges: [],
      nodeCount: 0,
      edgeCount: 0,
      lsn: 0,
    });

    expect(text).toContain('empty');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: commit then read
// ---------------------------------------------------------------------------

describe('graph tools end-to-end', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let reads: GraphReaders;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    specId = seedSpec(db);
    reads = createGraphReads(db, specId);
  });

  it('commit_graph creates nodes and edges readable by read_graph', () => {
    // Commit a small graph
    const input = translateCommitGraph(
      {
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Build auth' },
          {
            ref: 'n2',
            plane: 'intent',
            kind: 'requirement',
            title: 'JWT tokens',
          },
        ],
        edges: [{ category: 'dependency', source: 'n2', target: 'n1' }],
      },
      specId,
      () => undefined,
    );
    if ('status' in input) throw new Error('unreachable');
    const result = executor.commitGraph(input);
    expect(result.status).toBe('success');

    // Read the graph
    const overview = reads.getGraphOverview();
    const text = formatGraphOverview(overview);

    expect(overview.nodeCount).toBe(2);
    expect(overview.edgeCount).toBe(1);
    expect(text).toContain('Build auth');
    expect(text).toContain('JWT tokens');
    expect(text).toContain('dependency');
  });

  it('commit_graph publishes selected-spec graph update topics after successful commits', async () => {
    const productUpdates = createProductUpdatePublisher();
    const observed: unknown[] = [];
    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    productUpdates.subscribe((updates) => observed.push(...updates));
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads, productUpdates },
    );

    await tools.get('commit_graph')!.execute('call-1', {
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'Observable goal' }],
      edges: [],
    });

    expect(observed).toEqual([
      { topic: 'graph.overview', specId, lsn: 2 },
      { topic: 'graph.nodeNeighborhood', specId, lsn: 2 },
    ]);
  });

  it('commit_graph resolves selected-spec projected codes through the tool adapter', async () => {
    const existing = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Existing goal' });
    expect(existing.status).toBe('success');
    if (existing.status !== 'success') return;

    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const result = (await tools.get('commit_graph')!.execute('commit-1', {
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'requirement', title: 'New req' }],
      edges: [{ category: 'realization', source: { existingCode: 'G1' }, target: 'n1' }],
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('n1 → R1');
    expect(result.content[0]?.text).not.toContain('n1 → #');
    expect(result.details).toMatchObject({ status: 'success', createdNodes: { n1: { code: 'R1' } } });
    expect(db.select().from(edges).all()[0]!.source_id).toBe(existing.nodeId);
  });

  it('commit_graph rejects projected codes that belong to another selected spec', async () => {
    const otherSpecId = seedSpec(db);
    const otherExecutor = new CommandExecutor(db);
    const other = otherExecutor.createNode({
      specId: otherSpecId,
      plane: 'intent',
      kind: 'goal',
      title: 'Other spec goal',
    });
    expect(other.status).toBe('success');

    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const result = (await tools.get('commit_graph')!.execute('commit-1', {
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'requirement', title: 'New req' }],
      edges: [{ category: 'realization', source: { existingCode: 'G1' }, target: 'n1' }],
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('STRUCTURAL_ILLEGAL');
    expect(result.details).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edges[0].source' }],
    });
  });

  it('graph tool prompt guidance names projected codes rather than raw node ids', () => {
    const registered: Array<{ name: string; description?: string; promptGuidelines?: readonly string[] }> =
      [];
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; description?: string; promptGuidelines?: readonly string[] }) {
          registered.push(tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const text = registered
      .flatMap((tool) => [tool.description ?? '', ...(tool.promptGuidelines ?? [])])
      .join('\n');

    expect(text).toContain('existingCode');
    expect(text).toContain('nodeCode');
    expect(text).not.toContain('{existing: <id>}');
    expect(text).not.toContain('node_id');
  });

  it('commit_graph returns diagnostics on invalid batch', () => {
    const input = translateCommitGraph(
      {
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'not_a_kind' as never, title: 'Bad' }],
        edges: [],
      },
      specId,
      () => undefined,
    );
    if ('status' in input) throw new Error('unreachable');
    const result = executor.commitGraph(input);
    expect(result.status).toBe('structural_illegal');

    if (result.status === 'structural_illegal') {
      const text = formatCommitGraphResult(result);
      expect(text).toContain('STRUCTURAL_ILLEGAL');
      expect(text).toContain('not_a_kind');
    }
  });

  it('commit_graph with edge validation failure rolls back nodes (I34-L)', () => {
    const input = translateCommitGraph(
      {
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' }],
        edges: [
          // stance required for proof but missing
          { category: 'proof', source: 'n1', target: 'n1' },
        ],
      },
      specId,
      () => undefined,
    );
    if ('status' in input) throw new Error('unreachable');
    const result = executor.commitGraph(input);
    expect(result.status).toBe('structural_illegal');

    // Node should NOT have been created (all-or-nothing)
    const overview = reads.getGraphOverview();
    expect(overview.nodeCount).toBe(0);
  });

  it('read_graph neighborhood returns node details', () => {
    // Create a node first
    const input = translateCommitGraph(
      {
        nodes: [
          {
            ref: 'n1',
            plane: 'intent',
            kind: 'goal',
            title: 'Main goal',
            body: 'A detailed goal',
          },
        ],
        edges: [],
      },
      specId,
      () => undefined,
    );
    if ('status' in input) throw new Error('unreachable');
    const commitResult = executor.commitGraph(input);
    expect(commitResult.status).toBe('success');

    if (commitResult.status === 'success') {
      const nodeId = commitResult.createdNodes['n1']!.id;
      const result = reads.getNodeNeighborhood(nodeId);
      const text = formatNeighborhoodResult(result);

      expect(text).toContain('Main goal');
      expect(text).toContain('A detailed goal');
    }
  });

  it('read_graph neighborhood returns node-context markdown and typed details through the tool path', async () => {
    const input = translateCommitGraph(
      {
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Tool-visible goal', body: 'Selected body' },
        ],
        edges: [],
      },
      specId,
      () => undefined,
    );
    if ('status' in input) throw new Error('unreachable');
    const commitResult = executor.commitGraph(input);
    expect(commitResult.status).toBe('success');
    if (commitResult.status !== 'success') return;

    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const result = (await tools.get('read_graph')!.execute('read-1', {
      mode: 'neighborhood',
      nodeCode: 'G1',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toMatchInlineSnapshot(`
      "[Selected-spec node context]
      - anchor: [G1] intent/goal: Tool-visible goal
      - anchor body: Selected body
      - neighbors: none within requested hops
      - edges: none"
    `);
    expect(result.details).toMatchObject({
      status: 'success',
      anchor: { title: 'Tool-visible goal' },
      neighbors: [],
      edges: [],
    });
  });

  it('read_graph list modes return projection-aware slices with projected node codes', async () => {
    const oldRequirement = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Legacy requirement',
    });
    expect(oldRequirement.status).toBe('success');
    if (oldRequirement.status !== 'success') return;

    const commitResult = executor.commitGraph({
      specId,
      basis: 'implicit',
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Grounding goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Current requirement' },
      ],
      edges: [{ category: 'supersession', source: 'r1', target: { existing: oldRequirement.nodeId } }],
    });
    expect(commitResult.status).toBe('success');
    if (commitResult.status !== 'success') return;

    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const kindResult = (await tools.get('read_graph')!.execute('read-kind', {
      mode: 'list_by_kind',
      kinds: ['requirement'],
      projection: 'graph_truth',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(kindResult.content[0]?.text).toContain('Graph slice by kind');
    expect(kindResult.content[0]?.text).toContain('[R1]');
    expect(kindResult.content[0]?.text).toContain('[R2]');
    expect(kindResult.details).toMatchObject({
      nodeCount: 2,
      nodes: [{ title: 'Legacy requirement' }, { title: 'Current requirement' }],
    });

    const bandResult = (await tools.get('read_graph')!.execute('read-band', {
      mode: 'list_by_band',
      readinessBands: ['grounding'],
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(bandResult.content[0]?.text).toContain('Graph slice by readiness band');
    expect(bandResult.content[0]?.text).toContain('[G1]');
    expect(bandResult.details).toMatchObject({
      nodeCount: 1,
      nodes: [{ title: 'Grounding goal' }],
    });
  });

  it('read_graph list modes return an empty slice for unknown filters instead of diagnostics', async () => {
    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const result = (await tools.get('read_graph')!.execute('read-empty', {
      mode: 'list_by_band',
      readinessBands: ['unknown-band'],
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('empty');
    expect(result.details).toMatchObject({ nodeCount: 0, edgeCount: 0, nodes: [], edges: [] });
  });

  it('read_graph gaps mode returns projection-aware gaps and structural diagnostics', async () => {
    const commitResult = executor.commitGraph({
      specId,
      basis: 'implicit',
      nodes: [
        { ref: 'thesis-gap', plane: 'intent', kind: 'thesis', title: 'Unproven thesis' },
        { ref: 'thesis-supported', plane: 'intent', kind: 'thesis', title: 'Supported thesis' },
        {
          ref: 'term-gap',
          plane: 'intent',
          kind: 'term',
          title: 'Unproved term',
          detail: { definition: 'Gap' },
        },
        {
          ref: 'term-target',
          plane: 'intent',
          kind: 'term',
          title: 'Supported term',
          detail: { definition: 'Covered' },
        },
        { ref: 'evidence-live', plane: 'oracle', kind: 'evidence', title: 'Active evidence' },
        { ref: 'evidence-old', plane: 'oracle', kind: 'evidence', title: 'Superseded evidence' },
        { ref: 'evidence-new', plane: 'oracle', kind: 'evidence', title: 'Replacement evidence' },
      ],
      edges: [
        { category: 'proof', source: 'evidence-live', target: 'thesis-supported', stance: 'for' },
        { category: 'proof', source: 'evidence-old', target: 'term-target', stance: 'for' },
        { category: 'supersession', source: 'evidence-new', target: 'evidence-old' },
      ],
    });
    expect(commitResult.status).toBe('success');
    if (commitResult.status !== 'success') return;

    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const activeGaps = (await tools.get('read_graph')!.execute('read-gaps', {
      mode: 'gaps',
      kinds: ['term'],
      absentEdgeCategory: 'proof',
      direction: 'incoming',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(activeGaps.content[0]?.text).toContain('Graph gaps');
    expect(activeGaps.content[0]?.text).toContain('[T1]');
    expect(activeGaps.content[0]?.text).toContain('[T2]');
    expect(activeGaps.details).toMatchObject({
      nodeCount: 2,
      nodes: [{ title: 'Unproved term' }, { title: 'Supported term' }],
    });

    const truthGaps = (await tools.get('read_graph')!.execute('read-gaps-truth', {
      mode: 'gaps',
      kinds: ['term'],
      absentEdgeCategory: 'proof',
      direction: 'incoming',
      projection: 'graph_truth',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(truthGaps.details).toMatchObject({
      nodeCount: 1,
      nodes: [{ title: 'Unproved term' }],
    });

    const missingBase = (await tools.get('read_graph')!.execute('read-gaps-missing-base', {
      mode: 'gaps',
      absentEdgeCategory: 'proof',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(missingBase.content[0]?.text).toContain('STRUCTURAL_ILLEGAL');
    expect(missingBase.details).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'kinds|readinessBands' }],
    });

    const missingCategory = (await tools.get('read_graph')!.execute('read-gaps-missing-category', {
      mode: 'gaps',
      kinds: ['term'],
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(missingCategory.content[0]?.text).toContain('STRUCTURAL_ILLEGAL');
    expect(missingCategory.details).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'absentEdgeCategory' }],
    });
  });

  it('read_graph related mode returns related nodes and structural_illegal for unknown anchors', async () => {
    const commitResult = executor.commitGraph({
      specId,
      basis: 'implicit',
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Anchor requirement' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'Direct assumption' },
      ],
      edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
    });
    expect(commitResult.status).toBe('success');
    if (commitResult.status !== 'success') return;

    const tools = new Map<string, { execute(toolCallId: string, params: unknown): Promise<unknown> }>();
    registerBrunchGraph(
      {
        registerTool(tool: { name: string; execute(toolCallId: string, params: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool);
        },
      } as never,
      { specId, commandExecutor: executor, reads },
    );

    const related = (await tools.get('read_graph')!.execute('read-related', {
      mode: 'related',
      anchorCodes: ['R1'],
      edgeCategory: 'dependency',
      direction: 'outgoing',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(related.content[0]?.text).toContain('Related nodes');
    expect(related.content[0]?.text).toContain('dependency/outgoing');
    expect(related.content[0]?.text).toContain('[A1]');
    expect(related.details).toMatchObject({
      status: 'success',
      anchors: [{ title: 'Anchor requirement' }],
      relatedNodes: [{ title: 'Direct assumption' }],
    });

    const missingAnchor = (await tools.get('read_graph')!.execute('read-related-missing', {
      mode: 'related',
      anchorCodes: ['R99'],
      edgeCategory: 'dependency',
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };
    expect(missingAnchor.content[0]?.text).toContain('STRUCTURAL_ILLEGAL');
    expect(missingAnchor.details).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'anchorCodes' }],
    });
  });

  it('read_graph neighborhood for missing node returns not_found', () => {
    const result = reads.getNodeNeighborhood(999);
    const text = formatNeighborhoodResult(result);

    expect(text).toContain('not found');
  });

  it('formats related-node results with projected codes and directions', () => {
    const text = formatRelatedNodesResult({
      status: 'success',
      anchors: [
        {
          id: 1,
          specId: 1,
          plane: 'intent',
          kind: 'requirement',
          kindOrdinal: 1,
          title: 'Anchor requirement',
          basis: 'explicit',
          createdAtLsn: 1,
          updatedAtLsn: 1,
        },
      ],
      relatedNodes: [
        {
          id: 2,
          specId: 1,
          plane: 'intent',
          kind: 'assumption',
          kindOrdinal: 1,
          title: 'Related assumption',
          basis: 'explicit',
          createdAtLsn: 1,
          updatedAtLsn: 1,
        },
      ],
      edges: [
        {
          id: 1,
          specId: 1,
          category: 'dependency',
          sourceId: 1,
          targetId: 2,
          basis: 'explicit',
          createdAtLsn: 1,
          updatedAtLsn: 1,
        },
      ],
    });

    expect(text).toContain('Anchors: [R1] Anchor requirement');
    expect(text).toContain('[A1] intent/assumption');
    expect(text).toContain('R1 -[dependency/outgoing]-> A1');
  });
});
