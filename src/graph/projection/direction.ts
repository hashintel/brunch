/**
 * Directional projection — upstream / downstream / lateral.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md §"Context projections"
 *
 * Derives the reconciliation-impact axis from the per-category metadata.
 * "Downstream" is the endpoint that needs reconciliation when the other
 * endpoint changes; the reconciliation flow logs downstream impacts when a
 * node is edited. This axis does NOT track the source→target storage geometry:
 * for `dependency`/`realization`/`boundary` the source is upstream, but for
 * `proof`/`support`/`composition`/`supersession` the target is upstream.
 */

import {
  EDGE_CATEGORY_METADATA,
  type EdgeEndpoint,
  type EdgeImpactStrength,
} from '../policy/category-policy.js';
import type { EdgeCategory } from '../schema/edges.js';

/** Where a neighbor sits relative to the anchor along the impact axis. */
export type EdgeRelation = 'upstream' | 'downstream' | 'lateral';

export interface EdgeImpact {
  /** The downstream (impacted) endpoint, or `none` for symmetric edges. */
  readonly downstreamEndpoint: EdgeEndpoint | 'none';
  /** Impact strength along that direction. */
  readonly strength: EdgeImpactStrength;
}

/**
 * Which endpoint is downstream of the other, derived from impact metadata.
 * A well-formed category drives impact in at most one direction.
 */
export function edgeImpact(category: EdgeCategory): EdgeImpact {
  const metadata = EDGE_CATEGORY_METADATA[category];
  if (metadata.impactOnSourceChange !== 'none') {
    return { downstreamEndpoint: 'target', strength: metadata.impactOnSourceChange };
  }
  if (metadata.impactOnTargetChange !== 'none') {
    return { downstreamEndpoint: 'source', strength: metadata.impactOnTargetChange };
  }
  return { downstreamEndpoint: 'none', strength: 'none' };
}

export interface AnchoredRelation {
  readonly relation: EdgeRelation;
  /** Impact strength of the relationship (`none` for lateral). */
  readonly strength: EdgeImpactStrength;
}

/**
 * Classify a neighbor relative to the anchor.
 *
 * @param anchorRole which endpoint of the edge the anchor occupies.
 *  - anchor at the upstream end → neighbor is `downstream` (changing the
 *    anchor impacts the neighbor; log for reconciliation).
 *  - anchor at the downstream end → neighbor is `upstream` (changing the
 *    neighbor impacts the anchor; review the anchor).
 */
export function relationFromAnchor(category: EdgeCategory, anchorRole: EdgeEndpoint): AnchoredRelation {
  const { downstreamEndpoint, strength } = edgeImpact(category);
  if (downstreamEndpoint === 'none') return { relation: 'lateral', strength: 'none' };
  const anchorIsDownstream = anchorRole === downstreamEndpoint;
  return { relation: anchorIsDownstream ? 'upstream' : 'downstream', strength };
}
