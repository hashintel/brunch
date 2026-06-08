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
 *  - **impact direction** (`impactOnSourceChange` / `impactOnTargetChange`)
 *    feeds the directional projection (`projection/direction.ts`) — the
 *    upstream/downstream grouping the reconciliation flow logs against.
 *
 * It supersedes the prior split between the role/reconciliation metadata that
 * briefly lived in `schema/edges.ts` and the drifted `CATEGORY_POLICY` that
 * lived here (the two disagreed on impact direction for `proof`/`support`).
 *
 * Axes:
 *
 *  - `sourceRole` / `targetRole` — the semantic role each endpoint plays.
 *  - `impactOnSourceChange` — if the SOURCE node changes, how is the TARGET
 *     affected: `cascade` (hard — auto block/mark-stale; dependency only),
 *     `advisory` (soft — surface a ReconciliationNeed), or `none`.
 *  - `impactOnTargetChange` — symmetric: if the TARGET node changes, how is
 *     the SOURCE affected.
 *  - `criteriaHelpSignal` — the interviewer uses this edge when suggesting
 *     criteria for the claim ("requirement with no incoming `proof` → suggest
 *     a criterion").
 *  - `projectionEffect` — non-default effect on active-context builders.
 *
 * Phase 1 lock-and-materialize: data only. Coherence triggers, the
 * interviewer, and active-context filters consume this in later M4/M5 slices.
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
 * How strongly a change at one endpoint impacts the other.
 *  - `none`     — no reconciliation flows in this direction.
 *  - `advisory` — soft; surface a ReconciliationNeed for review.
 *  - `cascade`  — hard; may auto block / mark-stale (dependency only).
 */
export type EdgeImpactStrength = 'none' | 'advisory' | 'cascade';

export type ProjectionEffect = 'none' | 'hide_predecessor_from_active_context';

export interface EdgeCategoryMetadata {
  readonly sourceRole: EdgeEndpointRole;
  readonly targetRole: EdgeEndpointRole;
  readonly impactOnSourceChange: EdgeImpactStrength;
  readonly impactOnTargetChange: EdgeImpactStrength;
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
    impactOnSourceChange: 'cascade',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  proof: {
    sourceRole: 'oracle',
    targetRole: 'claim',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: true,
    projectionEffect: 'none',
  },
  support: {
    sourceRole: 'support',
    targetRole: 'claim',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  realization: {
    sourceRole: 'abstract',
    targetRole: 'concrete',
    impactOnSourceChange: 'advisory',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  boundary: {
    sourceRole: 'boundary',
    targetRole: 'subject',
    impactOnSourceChange: 'advisory',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  composition: {
    sourceRole: 'whole',
    targetRole: 'part',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  association: {
    sourceRole: 'peer',
    targetRole: 'peer',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  supersession: {
    sourceRole: 'successor',
    targetRole: 'predecessor',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'hide_predecessor_from_active_context',
  },
} as const satisfies EdgeCategoryMetadataByCategory;

/** The semantic role the given endpoint plays for this category. */
export function edgeEndpointRole(category: EdgeCategory, endpoint: EdgeEndpoint): EdgeEndpointRole {
  const metadata = EDGE_CATEGORY_METADATA[category];
  return endpoint === 'source' ? metadata.sourceRole : metadata.targetRole;
}
