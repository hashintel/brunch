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
import { graphClock, specs } from '../db/schema.js';
import { CommandExecutor } from './command-executor.js';
import { NODE_KIND_METADATA, parseGraphNodeCode } from './schema/nodes.js';
import {
  getGraphGaps,
  getGraphOverview,
  getGraphSliceByKinds,
  getGraphSliceByReadinessBands,
  getNodeNeighborhood,
  getRelatedNodes,
  getOpenReconciliationNeeds,
} from './snapshot.js';

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
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
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

  it('returns the selected spec LSN without sibling-spec mutations', () => {
    const specA = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
    const specB = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
    if (specA.status !== 'success' || specB.status !== 'success') throw new Error('unreachable');

    const before = getGraphOverview(db, specA.specId);
    executor.createNode({ specId: specB.specId, plane: 'intent', kind: 'goal', title: 'Spec B goal' });
    const after = getGraphOverview(db, specA.specId);

    expect(before.lsn).toBe(1);
    expect(after.lsn).toBe(1);
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

    const activeOverview = getGraphOverview(db, specId);
    const activeTitles = activeOverview.nodes.map((n) => n.title);
    expect(activeTitles).toContain('R_offline_v1');
    expect(activeTitles).not.toContain('R_offline_v0');
    expect(activeOverview.edges).toHaveLength(0);

    const truthOverview = getGraphOverview(db, specId, { projection: 'graph_truth' });
    expect(truthOverview.nodes.map((n) => n.title)).toEqual(
      expect.arrayContaining(['R_offline_v0', 'R_offline_v1']),
    );
    expect(truthOverview.edges).toHaveLength(1);
  });
});

describe('graph slice readers', () => {
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
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
  });

  it('lists nodes by kind, projection-aware', () => {
    const oldRequirement = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'R_v0',
    });
    expect(oldRequirement.status).toBe('success');
    if (oldRequirement.status !== 'success') throw new Error('unreachable');

    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R_v1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'G1' },
      ],
      edges: [
        { category: 'supersession', source: 'r1', target: { existing: oldRequirement.nodeId } },
        { category: 'dependency', source: 'r1', target: 'a1' },
        { category: 'support', source: 'g1', target: 'r1', stance: 'for' },
      ],
    });
    expect(batch.status).toBe('success');

    const activeSlice = getGraphSliceByKinds(db, specId, {
      kinds: ['requirement', 'assumption'],
      projection: 'active_context',
    });
    expect(activeSlice.nodes.map((node) => node.title).sort()).toEqual(['A1', 'R_v1']);
    expect(activeSlice.edges).toHaveLength(1);
    expect(activeSlice.edges[0]!.category).toBe('dependency');

    const truthSlice = getGraphSliceByKinds(db, specId, {
      kinds: ['requirement'],
      projection: 'graph_truth',
    });
    expect(truthSlice.nodes.map((node) => node.title).sort()).toEqual(['R_v0', 'R_v1']);
    expect(truthSlice.edges.map((edge) => edge.category)).toEqual(['supersession']);
  });

  it('lists nodes by readiness band, projection-aware', () => {
    const oldRequirement = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Legacy requirement',
    });
    expect(oldRequirement.status).toBe('success');
    if (oldRequirement.status !== 'success') throw new Error('unreachable');

    const batch = executor.commitGraph({
      specId,
      nodes: [
        {
          ref: 't1',
          plane: 'intent',
          kind: 'term',
          title: 'Term node',
          detail: { definition: 'Shared vocabulary entry' },
        },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Current requirement' },
        {
          ref: 'd1',
          plane: 'intent',
          kind: 'decision',
          title: 'Decision node',
          detail: { chosen_option: 'A', rejected: ['B'], rationale: 'Because' },
        },
      ],
      edges: [{ category: 'supersession', source: 'r1', target: { existing: oldRequirement.nodeId } }],
    });
    expect(batch.status).toBe('success');

    const activeSlice = getGraphSliceByReadinessBands(db, specId, {
      readinessBands: ['grounding', 'elicitation'],
      projection: 'active_context',
    });
    expect(activeSlice.nodes.map((node) => node.title).sort()).toEqual(['Current requirement', 'Term node']);

    const truthSlice = getGraphSliceByReadinessBands(db, specId, {
      readinessBands: ['commitment'],
      projection: 'graph_truth',
    });
    expect(truthSlice.nodes.map((node) => node.title).sort()).toEqual([
      'Current requirement',
      'Decision node',
      'Legacy requirement',
    ]);
  });

  it('returns an empty slice for empty or unknown kind/band filters', () => {
    const kindSlice = getGraphSliceByKinds(db, specId, { kinds: ['not_a_kind'] });
    expect(kindSlice).toMatchObject({ nodes: [], edges: [], nodeCount: 0, edgeCount: 0, lsn: 0 });

    const bandSlice = getGraphSliceByReadinessBands(db, specId, { readinessBands: ['not_a_band'] });
    expect(bandSlice).toMatchObject({ nodes: [], edges: [], nodeCount: 0, edgeCount: 0, lsn: 0 });
  });

  it('finds graph gaps with projection-aware edge absence', () => {
    const batch = executor.commitGraph({
      specId,
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
    expect(batch.status).toBe('success');

    const thesisGaps = getGraphGaps(db, specId, {
      kinds: ['thesis'],
      absentEdgeCategory: 'proof',
      direction: 'incoming',
      projection: 'active_context',
    });
    expect(thesisGaps.nodes.map((node) => node.title)).toEqual(['Unproven thesis']);

    const outgoingEvidenceGaps = getGraphGaps(db, specId, {
      kinds: ['evidence'],
      absentEdgeCategory: 'proof',
      direction: 'outgoing',
      projection: 'active_context',
    });
    expect(outgoingEvidenceGaps.nodes.map((node) => node.title)).toEqual(['Replacement evidence']);

    const activeTermGaps = getGraphGaps(db, specId, {
      readinessBands: ['grounding'],
      absentEdgeCategory: 'proof',
      direction: 'incoming',
      projection: 'active_context',
    });
    expect(activeTermGaps.nodes.map((node) => node.title).sort()).toEqual([
      'Supported term',
      'Unproved term',
      'Unproven thesis',
    ]);

    const truthTermGaps = getGraphGaps(db, specId, {
      kinds: ['term'],
      absentEdgeCategory: 'proof',
      direction: 'incoming',
      projection: 'graph_truth',
    });
    expect(truthTermGaps.nodes.map((node) => node.title)).toEqual(['Unproved term']);
  });

  it('returns an empty slice for gaps when the base filter is unknown', () => {
    const gaps = getGraphGaps(db, specId, {
      kinds: ['not_a_kind'],
      absentEdgeCategory: 'proof',
    });
    expect(gaps).toMatchObject({ nodes: [], edges: [], nodeCount: 0, edgeCount: 0, lsn: 0 });
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
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
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

    const r1Id = batch.createdNodes['r1']!.id;
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

    const g1Id = batch.createdNodes['g1']!.id;

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

    const r1Id = batch.createdNodes['r1']!.id;

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

    const t1Id = batch.createdNodes['t1']!.id;
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

describe('getRelatedNodes', () => {
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
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
  });

  it('finds related nodes by category, direction, and bounded hops', () => {
    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Anchor requirement' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'Direct assumption' },
        { ref: 'c1', plane: 'intent', kind: 'constraint', title: 'Two-hop constraint' },
      ],
      edges: [
        { category: 'dependency', source: 'r1', target: 'a1' },
        { category: 'dependency', source: 'a1', target: 'c1' },
      ],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const outgoing = getRelatedNodes(db, specId, {
      anchorIds: [batch.createdNodes['r1']!.id],
      edgeCategory: 'dependency',
      direction: 'outgoing',
      hops: 1,
    });
    expect(outgoing.status).toBe('success');
    if (outgoing.status !== 'success') throw new Error('unreachable');
    expect(outgoing.relatedNodes.map((node) => node.title)).toEqual(['Direct assumption']);

    const twoHop = getRelatedNodes(db, specId, {
      anchorIds: [batch.createdNodes['r1']!.id],
      edgeCategory: 'dependency',
      direction: 'outgoing',
      hops: 2,
    });
    expect(twoHop.status).toBe('success');
    if (twoHop.status !== 'success') throw new Error('unreachable');
    expect(twoHop.relatedNodes.map((node) => node.title).sort()).toEqual([
      'Direct assumption',
      'Two-hop constraint',
    ]);
    expect(twoHop.edges).toHaveLength(2);

    const incoming = getRelatedNodes(db, specId, {
      anchorIds: [batch.createdNodes['c1']!.id],
      edgeCategory: 'dependency',
      direction: 'incoming',
      hops: 1,
    });
    expect(incoming.status).toBe('success');
    if (incoming.status !== 'success') throw new Error('unreachable');
    expect(incoming.relatedNodes.map((node) => node.title)).toEqual(['Direct assumption']);
  });

  it('omits superseded related nodes in active_context but includes them in graph_truth', () => {
    const legacy = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Legacy requirement',
    });
    expect(legacy.status).toBe('success');
    if (legacy.status !== 'success') throw new Error('unreachable');

    const batch = executor.commitGraph({
      specId,
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Anchor goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Current requirement' },
      ],
      edges: [
        { category: 'support', source: 'g1', target: 'r1', stance: 'for' },
        { category: 'support', source: 'g1', target: { existing: legacy.nodeId }, stance: 'for' },
        { category: 'supersession', source: 'r1', target: { existing: legacy.nodeId } },
      ],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const active = getRelatedNodes(db, specId, {
      anchorIds: [batch.createdNodes['g1']!.id],
      edgeCategory: 'support',
      direction: 'outgoing',
      projection: 'active_context',
    });
    expect(active.status).toBe('success');
    if (active.status !== 'success') throw new Error('unreachable');
    expect(active.relatedNodes.map((node) => node.title)).toEqual(['Current requirement']);

    const truth = getRelatedNodes(db, specId, {
      anchorIds: [batch.createdNodes['g1']!.id],
      edgeCategory: 'support',
      direction: 'outgoing',
      projection: 'graph_truth',
    });
    expect(truth.status).toBe('success');
    if (truth.status !== 'success') throw new Error('unreachable');
    expect(truth.relatedNodes.map((node) => node.title).sort()).toEqual([
      'Current requirement',
      'Legacy requirement',
    ]);
  });

  it('returns not_found when any anchor does not belong to the selected spec', () => {
    const otherSpec = executor.createSpec({ name: 'Other Spec', slug: 'other-spec' });
    expect(otherSpec.status).toBe('success');
    if (otherSpec.status !== 'success') throw new Error('unreachable');
    const otherNode = executor.createNode({
      specId: otherSpec.specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Foreign anchor',
    });
    expect(otherNode.status).toBe('success');
    if (otherNode.status !== 'success') throw new Error('unreachable');

    expect(
      getRelatedNodes(db, specId, {
        anchorIds: [otherNode.nodeId],
        edgeCategory: 'dependency',
      }),
    ).toEqual({ status: 'not_found' });
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
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
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
