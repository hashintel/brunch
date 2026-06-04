/**
 * Graph snapshot reader tests — acceptance criteria for I35-L.
 *
 * SPEC: D52-L (graph/ reads db/), I35-L (cursory + neighborhood)
 * Scope card: Graph snapshot readers at cursory and neighborhood detail levels
 *
 * All graph state is seeded via CommandExecutor (no direct db writes).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { specs } from '../db/schema.js';
import { CommandExecutor } from './command-executor.js';
import { NODE_KIND_METADATA, parseGraphNodeCode } from './schema/nodes.js';
import { getGraphOverview, getNodeNeighborhood, getOpenReconciliationNeeds } from './snapshot.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('graph node code metadata', () => {
  it('uses globally unique 1-3 letter labels and parses by longest prefix', () => {
    const labels = Object.values(NODE_KIND_METADATA).map((metadata) => metadata.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((label) => /^[A-Z]{1,3}$/.test(label))).toBe(true);
    expect(Object.values(NODE_KIND_METADATA).every((metadata) => metadata.readinessBands.length > 0)).toBe(
      true,
    );
    expect(parseGraphNodeCode('A1')).toEqual({ kind: 'assumption', kindOrdinal: 1 });
    expect(parseGraphNodeCode('CON2')).toEqual({ kind: 'constraint', kindOrdinal: 2 });
    expect(parseGraphNodeCode('CR3')).toEqual({ kind: 'criterion', kindOrdinal: 3 });
  });
});
describe('getGraphOverview', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    db.insert(specs)
      .values({ name: 'Test Spec', slug: 'test', readiness_grade: 'grounding_onboarding' })
      .run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
  });

  it('returns empty arrays and zero counts on an empty graph', () => {
    const overview = getGraphOverview(db, specId);
    expect(overview.nodes).toEqual([]);
    expect(overview.edges).toEqual([]);
    expect(overview.nodeCount).toBe(0);
    expect(overview.edgeCount).toBe(0);
    expect(overview.lsn).toBe(0);
  });

  it('returns current LSN from graph_clock', () => {
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'G1' });
    executor.createNode({ specId, plane: 'intent', kind: 'thesis', title: 'T1' });
    const overview = getGraphOverview(db, specId);
    expect(overview.lsn).toBe(2);
  });

  it('returns typed domain objects with parsed detail JSON', () => {
    executor.createNode({
      specId,
      plane: 'intent',
      kind: 'decision',
      title: 'Use SQLite',
      body: 'Settled on SQLite',
      detail: {
        chosen_option: 'SQLite',
        rejected: ['PostgreSQL'],
        rationale: 'Simpler local deployment',
      },
    });

    const overview = getGraphOverview(db, specId);
    expect(overview.nodes).toHaveLength(1);
    const node = overview.nodes[0]!;
    expect(node.id).toBeTypeOf('number');
    expect(node.plane).toBe('intent');
    expect(node.kind).toBe('decision');
    expect(node.title).toBe('Use SQLite');
    expect(node.body).toBe('Settled on SQLite');
    expect(node.basis).toBe('explicit');
    expect(node.detail).toEqual({
      chosen_option: 'SQLite',
      rejected: ['PostgreSQL'],
      rationale: 'Simpler local deployment',
    });
    expect(node.createdAtLsn).toBe(1);
    expect(node.updatedAtLsn).toBe(1);
    expect(node.kindOrdinal).toBe(1);
  });

  it('returns nodes and edges with correct counts', () => {
    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
    });
    expect(batch.status).toBe('success');

    const overview = getGraphOverview(db, specId);
    expect(overview.nodeCount).toBe(2);
    expect(overview.edgeCount).toBe(1);
    expect(overview.nodes).toHaveLength(2);
    expect(overview.edges).toHaveLength(1);
    expect(overview.edges[0]!.category).toBe('dependency');
  });

  it('excludes superseded predecessors from overview', () => {
    // Create R_v0, then R_v1 that supersedes R_v0
    const r0 = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'R_offline_v0' });
    expect(r0.status).toBe('success');
    if (r0.status !== 'success') throw new Error('unreachable');
    const r0Id = r0.nodeId;

    const batch = executor.commitGraph({
      specId,
      nodes: [
        {
          ref: 'r1',
          plane: 'intent',
          kind: 'requirement',
          title: 'R_offline_v1',
        },
      ],
      edges: [
        {
          category: 'supersession',
          source: 'r1',
          target: { existing: r0Id },
        },
      ],
    });
    expect(batch.status).toBe('success');

    const overview = getGraphOverview(db, specId);
    // R_offline_v0 should be excluded (it is a superseded predecessor)
    const titles = overview.nodes.map((n) => n.title);
    expect(titles).toContain('R_offline_v1');
    expect(titles).not.toContain('R_offline_v0');
    // The supersession edge should still be present
    expect(overview.edges).toHaveLength(1);
  });
});

describe('getNodeNeighborhood', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    db.insert(specs)
      .values({ name: 'Test Spec', slug: 'test', readiness_grade: 'grounding_onboarding' })
      .run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
  });

  it('returns error for non-existent nodeId', () => {
    const result = getNodeNeighborhood(db, specId, 999);
    expect(result.status).toBe('not_found');
  });

  it('returns anchor node and directly connected nodes/edges at 1 hop (default)', () => {
    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'G1' },
      ],
      edges: [
        { category: 'dependency', source: 'r1', target: 'a1' },
        { category: 'support', source: 'g1', target: 'r1', stance: 'for' },
      ],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const r1Id = batch.nodes['r1']!;
    const result = getNodeNeighborhood(db, specId, r1Id);
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');

    expect(result.anchor.title).toBe('R1');
    // Should include A1 (dependency target) and G1 (support source)
    expect(result.neighbors).toHaveLength(2);
    const neighborTitles = result.neighbors.map((n) => n.title).sort();
    expect(neighborTitles).toEqual(['A1', 'G1']);
    expect(result.edges).toHaveLength(2);
  });

  it('reaches 2-hop neighbors', () => {
    // G1 -> R1 -> A1 (chain of depth 2 from G1)
    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'G1' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [
        { category: 'support', source: 'g1', target: 'r1', stance: 'for' },
        { category: 'dependency', source: 'r1', target: 'a1' },
      ],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const g1Id = batch.nodes['g1']!;

    // 1 hop: only R1
    const hop1 = getNodeNeighborhood(db, specId, g1Id, { hops: 1 });
    expect(hop1.status).toBe('success');
    if (hop1.status !== 'success') throw new Error('unreachable');
    expect(hop1.neighbors.map((n) => n.title)).toEqual(['R1']);

    // 2 hops: R1 and A1
    const hop2 = getNodeNeighborhood(db, specId, g1Id, { hops: 2 });
    expect(hop2.status).toBe('success');
    if (hop2.status !== 'success') throw new Error('unreachable');
    const titles = hop2.neighbors.map((n) => n.title).sort();
    expect(titles).toEqual(['A1', 'R1']);
  });

  it('excludes superseded predecessors from neighborhood (unless anchor)', () => {
    // R_v0 superseded by R_v1, with A1 depending on R_v1
    const r0 = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'R_v0' });
    expect(r0.status).toBe('success');
    if (r0.status !== 'success') throw new Error('unreachable');
    const r0Id = r0.nodeId;

    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R_v1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [
        { category: 'supersession', source: 'r1', target: { existing: r0Id } },
        { category: 'dependency', source: 'r1', target: 'a1' },
      ],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const r1Id = batch.nodes['r1']!;

    // Neighborhood of R_v1: should include A1 but exclude R_v0
    const result = getNodeNeighborhood(db, specId, r1Id);
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');

    const neighborTitles = result.neighbors.map((n) => n.title);
    expect(neighborTitles).toContain('A1');
    expect(neighborTitles).not.toContain('R_v0');

    // But if R_v0 is the anchor, it should still be returned
    const r0Result = getNodeNeighborhood(db, specId, r0Id);
    expect(r0Result.status).toBe('success');
    if (r0Result.status !== 'success') throw new Error('unreachable');
    expect(r0Result.anchor.title).toBe('R_v0');
  });

  it('returns typed GraphNode and GraphEdge domain objects', () => {
    const batch = executor.commitGraph({
      specId,
      nodes: [
        {
          ref: 't1',
          plane: 'intent',
          kind: 'term',
          title: 'Widget',
          detail: { definition: 'A reusable component', aliases: ['gadget'] },
        },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
      ],
      edges: [{ category: 'boundary', source: 't1', target: 'r1' }],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const t1Id = batch.nodes['t1']!;
    const result = getNodeNeighborhood(db, specId, t1Id);
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');

    // Anchor has parsed detail
    expect(result.anchor.detail).toEqual({
      definition: 'A reusable component',
      aliases: ['gadget'],
    });

    // Edge has typed fields
    const edge = result.edges[0]!;
    expect(edge.category).toBe('boundary');
    expect(edge.sourceId).toBe(t1Id);
    expect(edge.createdAtLsn).toBeTypeOf('number');
  });
});

describe('getOpenReconciliationNeeds', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    db.insert(specs)
      .values({ name: 'Test Spec', slug: 'test', readiness_grade: 'grounding_onboarding' })
      .run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
  });

  it('returns empty array when no needs exist', () => {
    const needs = getOpenReconciliationNeeds(db, specId);
    expect(needs).toEqual([]);
  });

  it('returns open needs as typed domain objects', () => {
    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const create = executor.createReconciliationNeed({
      specId,
      target: { kind: 'edge', edgeId: batch.edges[0]! },
      needKind: 'edge_revalidation',
      reason: 'upstream changed',
    });
    expect(create.status).toBe('success');
    if (create.status !== 'success') throw new Error('unreachable');

    const needs = getOpenReconciliationNeeds(db, specId);
    expect(needs).toHaveLength(1);
    expect(needs[0]!.kind).toBe('edge_revalidation');
    expect(needs[0]!.target).toEqual({ kind: 'edge', edgeId: batch.edges[0]! });
    expect(needs[0]!.rationale).toBe('upstream changed');
    expect(needs[0]!.createdAtLsn).toBeTypeOf('number');
  });

  it('excludes resolved needs', () => {
    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const create = executor.createReconciliationNeed({
      specId,
      target: { kind: 'edge', edgeId: batch.edges[0]! },
      needKind: 'edge_revalidation',
    });
    expect(create.status).toBe('success');
    if (create.status !== 'success') throw new Error('unreachable');

    executor.resolveReconciliationNeed({ specId, id: create.id });

    const needs = getOpenReconciliationNeeds(db, specId);
    expect(needs).toEqual([]);
  });
});
