/**
 * Per-edge-category metadata — the single source of edge-category semantics.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md §"Per-category policy"
 *
 * This table is the one place that maps a structural edge `category` to its
 * derived semantics. Two projection families read from it:
 *
 *  - **endpoint roles** (`sourceRole` / `targetRole`) feed the semantic-label
 *    projection (`projection/labels.ts`) — direction-aware phrasing like
 *    "depends on" / "realizes" rendered from one endpoint's perspective.
 *  - **impact direction** (`affected` / `impactKind`) feeds the directional
 *    projection (`projection/direction.ts`) — the upstream/downstream grouping
 *    the reconciliation flow logs against.
 *
 * Endpoint storage order (`source`/`target`) carries no impact meaning. Impact
 * direction is given solely by `affected`; transitivity is given by
 * `impactKind`. Consult the metadata — never infer direction from which node
 * was stored as `source`.
 */

import type { EdgeCategory } from '../schema/edges.js';

/** Which end of a stored edge an endpoint sits on. */
export type EdgeEndpoint = 'source' | 'target';

/** The semantic role an endpoint plays within its category. */
export type EdgeEndpointRole =
  | 'dependency'
  | 'dependent'
  | 'oracle'
  | 'claim'
  | 'support'
  | 'abstract'
  | 'concrete'
  | 'boundary'
  | 'subject'
  | 'whole'
  | 'part'
  | 'successor'
  | 'predecessor'
  | 'peer';

/**
 * How strongly impact propagates from the non-affected endpoint to `affected`.
 *  - `none`     — no reconciliation flows in this category.
 *  - `advisory` — soft; surface a ReconciliationNeed for review.
 *  - `cascade`  — hard; may auto block / mark-stale (dependency only).
 */
export type EdgeImpactStrength = 'none' | 'advisory' | 'cascade';

export type ProjectionEffect = 'none' | 'hide_predecessor_from_active_context';

export interface EdgeCategoryMetadata {
  readonly sourceRole: EdgeEndpointRole;
  readonly targetRole: EdgeEndpointRole;
  readonly affected: EdgeEndpoint | null;
  readonly impactKind: EdgeImpactStrength;
  readonly stanceRequired: boolean;
  readonly criteriaHelpSignal: boolean;
  readonly projectionEffect: ProjectionEffect;
}

type EdgeCategoryMetadataByCategory = {
  readonly [Category in EdgeCategory]: EdgeCategoryMetadata;
};

export const EDGE_CATEGORY_METADATA = {
  dependency: {
    sourceRole: 'dependency',
    targetRole: 'dependent',
    affected: 'target',
    impactKind: 'cascade',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  witness: {
    sourceRole: 'oracle',
    targetRole: 'claim',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: true,
    criteriaHelpSignal: true,
    projectionEffect: 'none',
  },
  rationale: {
    sourceRole: 'support',
    targetRole: 'claim',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: true,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  realization: {
    sourceRole: 'abstract',
    targetRole: 'concrete',
    affected: 'target',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  refinement: {
    sourceRole: 'abstract',
    targetRole: 'concrete',
    affected: 'target',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  exclusion: {
    sourceRole: 'boundary',
    targetRole: 'subject',
    affected: 'target',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  composition: {
    sourceRole: 'whole',
    targetRole: 'part',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  cross_reference: {
    sourceRole: 'peer',
    targetRole: 'peer',
    affected: null,
    impactKind: 'none',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  supersession: {
    sourceRole: 'successor',
    targetRole: 'predecessor',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'hide_predecessor_from_active_context',
  },
} as const satisfies EdgeCategoryMetadataByCategory;

/** The semantic role the given endpoint plays for this category. */
export function edgeEndpointRole(category: EdgeCategory, endpoint: EdgeEndpoint): EdgeEndpointRole {
  const metadata = EDGE_CATEGORY_METADATA[category];
  return endpoint === 'source' ? metadata.sourceRole : metadata.targetRole;
}
