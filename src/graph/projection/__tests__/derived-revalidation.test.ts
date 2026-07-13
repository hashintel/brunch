/**
 * Derived `edge_revalidation` staleness — the pure derivation, executable.
 *
 * Staleness is read from per-category impact metadata (D51-L) plus the LSN gap
 * between an edge's upstream endpoint and the edge's own `updatedAtLsn` (the
 * pre-watermark acknowledged proxy). This suite pins derivation correctness and
 * the per-category / per-impactKind counts the noise verdict reads.
 */

import { describe, expect, it } from 'vitest';

import type { EdgeCategory, GraphEdge } from '../../schema/edges.js';
import type { GraphNode } from '../../schema/nodes.js';
import {
  deriveEdgeRevalidations,
  summarizeDerivedRevalidations,
  type DerivedEdgeRevalidation,
} from '../derived-revalidation.js';

function node(id: number, updatedAtLsn: number): GraphNode {
  return {
    id,
    specId: 1,
    plane: 'intent',
    kind: 'requirement',
    kindOrdinal: id,
    title: `N${id}`,
    basis: 'explicit',
    settlement: 'settled',
    createdAtLsn: 1,
    updatedAtLsn,
  };
}

function edge(
  id: number,
  category: EdgeCategory,
  sourceId: number,
  targetId: number,
  updatedAtLsn: number,
  acknowledgedLsn?: number,
): GraphEdge {
  return {
    id,
    specId: 1,
    category,
    sourceId,
    targetId,
    basis: 'explicit',
    settlement: 'settled',
    createdAtLsn: 1,
    updatedAtLsn,
    ...(acknowledgedLsn !== undefined ? { acknowledgedLsn } : {}),
  };
}

describe('deriveEdgeRevalidations', () => {
  it('derives an entry when a cascade edge upstream endpoint updated past the edge (dependency: source upstream)', () => {
    // dependency: affected=target, so source is upstream.
    const nodes = [node(1, 5), node(2, 1)];
    const edges = [edge(10, 'dependency', 1, 2, 2)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual<DerivedEdgeRevalidation[]>([
      {
        derived: true,
        kind: 'edge_revalidation',
        edgeId: 10,
        category: 'dependency',
        impactKind: 'cascade',
        downstreamEndpoint: 'target',
        upstreamNodeId: 1,
        downstreamNodeId: 2,
        lsnDelta: 3,
      },
    ]);
  });

  it('derives an entry for an advisory category and resolves upstream as the non-affected endpoint (witness: target upstream)', () => {
    // witness: affected=source, so target is upstream.
    const nodes = [node(1, 1), node(2, 4)];
    const edges = [edge(11, 'witness', 1, 2, 2)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual<DerivedEdgeRevalidation[]>([
      {
        derived: true,
        kind: 'edge_revalidation',
        edgeId: 11,
        category: 'witness',
        impactKind: 'advisory',
        downstreamEndpoint: 'source',
        upstreamNodeId: 2,
        downstreamNodeId: 1,
        lsnDelta: 2,
      },
    ]);
  });

  it('derives nothing for a `none`-impact category even when the upstream endpoint updated (cross_reference)', () => {
    const nodes = [node(1, 9), node(2, 1)];
    const edges = [edge(12, 'cross_reference', 1, 2, 2)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual([]);
  });

  it('derives nothing for an up-to-date edge (upstream not updated past the edge)', () => {
    const nodes = [node(1, 2), node(2, 1)];
    const edges = [edge(13, 'dependency', 1, 2, 2)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual([]);
  });

  it('ignores edges whose upstream endpoint node is absent from the slice', () => {
    const nodes = [node(2, 1)];
    const edges = [edge(14, 'dependency', 1, 2, 1)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual([]);
  });

  it('derives nothing when the acknowledged-LSN watermark is at or past the upstream LSN', () => {
    // upstream lsn 5, edge updatedAtLsn 2, acknowledged watermark 5 → effective ack 5 ≥ 5.
    const nodes = [node(1, 5), node(2, 1)];
    const edges = [edge(15, 'dependency', 1, 2, 2, 5)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual([]);
  });

  it('re-derives when upstream churns past the acknowledged-LSN watermark', () => {
    // watermark 5, then upstream moves to 6 → un-acknowledged newer upstream.
    const nodes = [node(1, 6), node(2, 1)];
    const edges = [edge(16, 'dependency', 1, 2, 2, 5)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual<DerivedEdgeRevalidation[]>([
      {
        derived: true,
        kind: 'edge_revalidation',
        edgeId: 16,
        category: 'dependency',
        impactKind: 'cascade',
        downstreamEndpoint: 'target',
        upstreamNodeId: 1,
        downstreamNodeId: 2,
        lsnDelta: 1,
      },
    ]);
  });

  it("clears via the edge's own updatedAtLsn advancing to the upstream LSN (fuller downstream edit, correction 3)", () => {
    // A fuller downstream edit advances the edge's updatedAtLsn; effective ack is the
    // greater of the stale watermark (3) and the edge's own updatedAtLsn (5) → 5 ≥ 5.
    const nodes = [node(1, 5), node(2, 1)];
    const edges = [edge(17, 'dependency', 1, 2, 5, 3)];
    expect(deriveEdgeRevalidations(nodes, edges)).toEqual([]);
  });

  it('with a null watermark behaves exactly as the edge-updatedAtLsn proxy did', () => {
    // No acknowledgedLsn: effective ack falls back to the edge's own updatedAtLsn (2).
    const nodes = [node(1, 5), node(2, 1)];
    const withoutWatermark = deriveEdgeRevalidations(nodes, [edge(18, 'dependency', 1, 2, 2)]);
    const withNullWatermark = deriveEdgeRevalidations(nodes, [edge(18, 'dependency', 1, 2, 2, undefined)]);
    expect(withNullWatermark).toEqual(withoutWatermark);
    expect(withNullWatermark).toHaveLength(1);
    expect(withNullWatermark[0]!.lsnDelta).toBe(3);
  });
});

describe('summarizeDerivedRevalidations', () => {
  it('counts derived entries by category and impactKind over a known stale/fresh/none mix', () => {
    // Stale: dependency (cascade), realization (advisory), witness (advisory).
    // Fresh: a second dependency that is up-to-date. None-impact: cross_reference.
    const nodes = [
      node(1, 5),
      node(2, 1),
      node(3, 5),
      node(4, 1),
      node(5, 5),
      node(6, 1),
      node(7, 2),
      node(8, 1),
    ];
    const edges = [
      edge(20, 'dependency', 1, 2, 2), // stale cascade
      edge(21, 'realization', 3, 4, 2), // stale advisory (affected=target → source upstream)
      edge(22, 'witness', 6, 5, 2), // stale advisory (affected=source → target(5) upstream)
      edge(23, 'dependency', 7, 8, 3), // fresh cascade (upstream lsn 2 <= edge lsn 3)
      edge(24, 'cross_reference', 1, 2, 1), // none-impact, ignored
    ];
    const derived = deriveEdgeRevalidations(nodes, edges);
    expect(summarizeDerivedRevalidations(derived)).toEqual({
      total: 3,
      byCategory: { dependency: 1, realization: 1, witness: 1 },
      byImpactKind: { advisory: 2, cascade: 1 },
    });
  });

  it('reports an empty summary when nothing is stale', () => {
    expect(summarizeDerivedRevalidations([])).toEqual({
      total: 0,
      byCategory: {},
      byImpactKind: { advisory: 0, cascade: 0 },
    });
  });
});
