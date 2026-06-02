/**
 * Graph tool integration tests.
 *
 * Tests the commit_graph and read_graph tools end-to-end through
 * the command adapter → CommandExecutor → snapshot reader chain.
 *
 * SPEC: D4-L, D20-L, D52-L, D53-L, I26-L, I34-L, A14-L
 */

import { describe, beforeEach, it, expect } from 'vitest';

import { createDb } from '../../db/connection.js';
import type { BrunchDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { getGraphOverview, getNodeNeighborhood } from '../../graph/snapshot.js';
import {
  translateCommitGraph,
  formatCommitGraphResult,
  formatGraphOverview,
  formatNeighborhoodResult,
} from '../extensions/graph/command-adapter.js';
import type { GraphSnapshotReaders } from '../extensions/graph/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

function createSnapshots(db: BrunchDb): GraphSnapshotReaders {
  return {
    getGraphOverview: () => getGraphOverview(db),
    getNodeNeighborhood: (nodeId, options) => getNodeNeighborhood(db, nodeId, options),
  };
}

// ---------------------------------------------------------------------------
// command-adapter: translateCommitGraph
// ---------------------------------------------------------------------------

describe('translateCommitGraph', () => {
  it('translates flat tool params into CommitGraphInput', () => {
    const input = translateCommitGraph({
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
          source: { existing: 42 },
          target: 'n1',
          stance: 'for',
        },
      ],
    });

    expect(input.nodes).toHaveLength(2);
    expect(input.nodes[0]!.ref).toBe('n1');
    expect(input.edges).toHaveLength(2);
    expect(input.edges[0]!.source).toBe('n2');
    expect(input.edges[1]!.source).toEqual({ existing: 42 });
  });
});

// ---------------------------------------------------------------------------
// command-adapter: formatCommitGraphResult
// ---------------------------------------------------------------------------

describe('formatCommitGraphResult', () => {
  it('formats success with node refs and edge ids', () => {
    const text = formatCommitGraphResult({
      status: 'success',
      lsn: 5,
      nodes: { n1: 1, n2: 2 },
      edges: [10, 11],
    });

    expect(text).toContain('Graph committed successfully');
    expect(text).toContain('LSN 5');
    expect(text).toContain('n1 → #1');
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
  let snapshots: GraphSnapshotReaders;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    snapshots = createSnapshots(db);
  });

  it('commit_graph creates nodes and edges readable by read_graph', () => {
    // Commit a small graph
    const input = translateCommitGraph({
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
    });
    const result = executor.commitGraph(input);
    expect(result.status).toBe('success');

    // Read the graph
    const overview = snapshots.getGraphOverview();
    const text = formatGraphOverview(overview);

    expect(overview.nodeCount).toBe(2);
    expect(overview.edgeCount).toBe(1);
    expect(text).toContain('Build auth');
    expect(text).toContain('JWT tokens');
    expect(text).toContain('dependency');
  });

  it('commit_graph returns diagnostics on invalid batch', () => {
    const input = translateCommitGraph({
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'not_a_kind', title: 'Bad' }],
      edges: [],
    });
    const result = executor.commitGraph(input);
    expect(result.status).toBe('structural_illegal');

    if (result.status === 'structural_illegal') {
      const text = formatCommitGraphResult(result);
      expect(text).toContain('STRUCTURAL_ILLEGAL');
      expect(text).toContain('not_a_kind');
    }
  });

  it('commit_graph with edge validation failure rolls back nodes (I34-L)', () => {
    const input = translateCommitGraph({
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' }],
      edges: [
        // stance required for proof but missing
        { category: 'proof', source: 'n1', target: 'n1' },
      ],
    });
    const result = executor.commitGraph(input);
    expect(result.status).toBe('structural_illegal');

    // Node should NOT have been created (all-or-nothing)
    const overview = snapshots.getGraphOverview();
    expect(overview.nodeCount).toBe(0);
  });

  it('read_graph neighborhood returns node details', () => {
    // Create a node first
    const input = translateCommitGraph({
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
    });
    const commitResult = executor.commitGraph(input);
    expect(commitResult.status).toBe('success');

    if (commitResult.status === 'success') {
      const nodeId = commitResult.nodes['n1']!;
      const result = snapshots.getNodeNeighborhood(nodeId);
      const text = formatNeighborhoodResult(result);

      expect(text).toContain('Main goal');
      expect(text).toContain('A detailed goal');
    }
  });

  it('read_graph neighborhood for missing node returns not_found', () => {
    const result = snapshots.getNodeNeighborhood(999);
    const text = formatNeighborhoodResult(result);

    expect(text).toContain('not found');
  });
});
