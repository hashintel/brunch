import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import {
  getNodes,
  queryGraph,
  resolveGraphNodeCode,
  type GraphFilter,
  type GraphVisibility,
} from '../../graph/queries.js';
import {
  translateCommitGraph,
  formatCommitGraphResult,
  formatGraphOverview,
} from '../extensions/graph/command-adapter.js';
import { registerBrunchGraph, type GraphReaders } from '../extensions/graph/index.js';

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
  };
}

describe('graph tool adapter', () => {
  it('translates existing projected codes before handing edges to CommandExecutor', () => {
    const input = translateCommitGraph(
      {
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'Test goal' }],
        edges: [{ category: 'support', source: { existingCode: 'G1' }, target: 'n1', stance: 'for' }],
      },
      7,
      (code) => (code === 'G1' ? 42 : undefined),
    );

    expect('status' in input).toBe(false);
    if ('status' in input) throw new Error('unreachable');
    expect(input.edges[0]!.source).toEqual({ existing: 42 });
  });

  it('formats graph slices for LLM-facing tool content', () => {
    expect(formatGraphOverview({ nodes: [], edges: [], lsn: 0 })).toContain('empty');
  });
});

describe('graph tools end-to-end', () => {
  it('commit_graph creates nodes and read_graph overview reads the selected-spec slice', async () => {
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

    const commit = tools.find((tool) => tool.name === 'commit_graph')!;
    const read = tools.find((tool) => tool.name === 'read_graph')!;

    const commitResult = (await commit.execute('tool-1', {
      nodes: [
        { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Build graph API' },
        { ref: 'n2', plane: 'intent', kind: 'requirement', title: 'Expose queryGraph' },
      ],
      edges: [{ category: 'dependency', source: 'n2', target: 'n1' }],
    } as never)) as { content: readonly { text: string }[]; details: { status: string } };

    expect(commitResult.details.status).toBe('success');
    expect(formatCommitGraphResult(commitResult.details as never)).toContain('Graph committed successfully');

    const readResult = (await read.execute('tool-2', { mode: 'overview' } as never)) as {
      content: readonly { text: string }[];
      details: { nodes: readonly unknown[]; edges: readonly unknown[] };
    };

    expect(readResult.details.nodes).toHaveLength(2);
    expect(readResult.details.edges).toHaveLength(1);
    expect(readResult.content[0]!.text).toContain('Build graph API');
  });
});
