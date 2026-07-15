/**
 * Derived `edge_revalidation` staleness projection — the read-only tracer.
 *
 * Canonical reference: memory/SPEC.md D51-L (per-category impact policy),
 * D8-L/A8-L (reconciliation-need substrate stays authoritative); PLAN frontier
 * `reconciliation-derivation`.
 *
 * A derived staleness signal, computed — never persisted. For each edge whose
 * category declares an impact direction (`advisory`/`cascade`), the upstream
 * endpoint is the non-`affected` node; the edge is stale when that upstream node
 * was updated past the edge's effective acknowledgement — the greater of the
 * per-edge `acknowledgedLsn` watermark and the edge's own `updatedAtLsn`
 * (PLAN correction 3). A null watermark falls back to `updatedAtLsn`, matching
 * the pre-watermark proxy. `none`-impact categories derive nothing.
 *
 * This is the tracer whose noise verdict gates the watermark schema. It writes
 * NOTHING (I16-L stop-the-line): the result is a DISTINCT read shape carrying a
 * `derived: true` marker and no need id, never a `ReconciliationNeed` row.
 *
 * Pure functions; no DB access. The DB-facing read that feeds these lives in
 * `graph/queries.ts` (`getDerivedEdgeRevalidations`).
 */

import type { NodeId, EdgeId } from '../atoms.js';
import type { EdgeEndpoint } from '../policy/category-policy.js';
import type { EdgeCategory, GraphEdge } from '../schema/edges.js';
import type { GraphNode } from '../schema/nodes.js';
import { edgeImpact } from './direction.js';

/** Impact strengths that can produce a derived need — the `none` case is excluded by construction. */
export type DerivableImpactKind = 'advisory' | 'cascade';

/**
 * A computed staleness signal over an edge. Distinct from a persisted
 * `ReconciliationNeed`: the `derived: true` marker and the absence of a need id
 * keep it from being mistaken for a substrate row.
 */
export interface DerivedEdgeRevalidation {
  readonly derived: true;
  readonly kind: 'edge_revalidation';
  readonly edgeId: EdgeId;
  readonly category: EdgeCategory;
  readonly impactKind: DerivableImpactKind;
  /** Which endpoint the impact flows to, per category metadata. */
  readonly downstreamEndpoint: EdgeEndpoint;
  readonly upstreamNodeId: NodeId;
  readonly downstreamNodeId: NodeId;
  /** `upstreamNode.updatedAtLsn - effectiveAcknowledgedLsn`; always `> 0` for a derived entry. */
  readonly lsnDelta: number;
}

/** Noise-verdict counts: how many derived needs, split by category and impact strength. */
export interface DerivedRevalidationSummary {
  readonly total: number;
  readonly byCategory: Partial<Record<EdgeCategory, number>>;
  readonly byImpactKind: Record<DerivableImpactKind, number>;
}

/**
 * Derive the stale `edge_revalidation` signals over a graph slice.
 *
 * @param nodes graph nodes carrying `updatedAtLsn`
 * @param edges graph edges carrying `updatedAtLsn`
 */
export function deriveEdgeRevalidations(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): DerivedEdgeRevalidation[] {
  const nodeById = new Map<NodeId, GraphNode>(nodes.map((n) => [n.id, n]));
  const derived: DerivedEdgeRevalidation[] = [];

  for (const edge of edges) {
    const { downstreamEndpoint, strength } = edgeImpact(edge.category);
    if (downstreamEndpoint === 'none' || strength === 'none') continue;

    const downstreamNodeId = downstreamEndpoint === 'target' ? edge.targetId : edge.sourceId;
    const upstreamNodeId = downstreamEndpoint === 'target' ? edge.sourceId : edge.targetId;
    const upstreamNode = nodeById.get(upstreamNodeId);
    if (!upstreamNode) continue;

    // Effective acknowledgement is the greater of the per-edge watermark and the
    // edge's own updatedAtLsn — a fuller downstream edit (advancing updatedAtLsn)
    // clears staleness even without an explicit acknowledgement (correction 3).
    // A null watermark falls back to updatedAtLsn (the pre-watermark proxy).
    const effectiveAcknowledgedLsn = Math.max(edge.acknowledgedLsn ?? edge.updatedAtLsn, edge.updatedAtLsn);
    const lsnDelta = upstreamNode.updatedAtLsn - effectiveAcknowledgedLsn;
    if (lsnDelta <= 0) continue;

    derived.push({
      derived: true,
      kind: 'edge_revalidation',
      edgeId: edge.id,
      category: edge.category,
      impactKind: strength,
      downstreamEndpoint,
      upstreamNodeId,
      downstreamNodeId,
      lsnDelta,
    });
  }

  return derived;
}

/** Aggregate derived needs into the counts the noise verdict reports. */
export function summarizeDerivedRevalidations(
  derived: readonly DerivedEdgeRevalidation[],
): DerivedRevalidationSummary {
  const byCategory: Partial<Record<EdgeCategory, number>> = {};
  const byImpactKind: Record<DerivableImpactKind, number> = { advisory: 0, cascade: 0 };

  for (const entry of derived) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    byImpactKind[entry.impactKind] += 1;
  }

  return { total: derived.length, byCategory, byImpactKind };
}
