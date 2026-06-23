/**
 * Semantic-label projection — direction-aware phrasing from one endpoint.
 *
 * Canonical reference: memory/SPEC.md D51-L; src/graph/policy/category-policy.ts (anchor-relative labels derive from category + endpoint role)
 *
 * Produces plain-language headings for an edge read from the anchor's
 * perspective ("depends on", "realizes", "motivated by"), so renderers never
 * leak the raw structural vocabulary (`category`, endpoint roles) into context.
 *
 * Two tiers:
 *  - Tier 1 (base): keyed on `(category, anchorRole, stance)`. ~18 cells;
 *    covers every edge.
 *  - Tier 2 (refine): keyed on `(category, sourceKind, targetKind)`. Optional
 *    finer verbs where the neighbor's kind alone is too vague — primarily the
 *    realization sub-types. Kept deliberately small.
 */

import type { EdgeEndpoint } from '../policy/category-policy.js';
import type { EdgeCategory, EdgeStance } from '../schema/edges.js';
import type { NodeKind } from '../schema/nodes.js';

/** Which endpoint of the edge the anchor occupies. */
export type AnchorRole = EdgeEndpoint;

type StanceKey = EdgeStance | 'none';

function stanceKey(stance: EdgeStance | undefined): StanceKey {
  return stance ?? 'none';
}

// Tier 1 — base headings, read from the anchor's perspective.
// The neighbor's kind is rendered separately, so headings never embed it.
const BASE: Record<EdgeCategory, Record<AnchorRole, Partial<Record<StanceKey, string>>>> = {
  dependency: {
    source: { none: 'required by' }, // anchor is the dependency; neighbor depends on it
    target: { none: 'depends on' }, // anchor is the dependent
  },
  witness: {
    source: { for: 'witnesses', against: 'refutes' }, // anchor is the oracle
    target: { for: 'witnessed by', against: 'challenged by' }, // anchor is the claim
  },
  rationale: {
    source: { for: 'supports', against: 'argues against' }, // anchor is the support
    target: { for: 'motivated by', against: 'opposed by' }, // anchor is the claim
  },
  realization: {
    source: { none: 'realized by' }, // anchor is abstract
    target: { none: 'realizes' }, // anchor is concrete
  },
  refinement: {
    source: { none: 'refined by' }, // anchor is abstract
    target: { none: 'refines' }, // anchor is concrete
  },
  exclusion: {
    source: { none: 'bounds' }, // anchor is the exclusion
    target: { none: 'bounded by' }, // anchor is the subject
  },
  composition: {
    source: { none: 'contains' }, // anchor is the whole
    target: { none: 'part of' }, // anchor is a part
  },
  supersession: {
    source: { none: 'supersedes' }, // anchor is the successor
    target: { none: 'superseded by' }, // anchor is the predecessor
  },
  cross_reference: {
    source: { none: 'related to' },
    target: { none: 'related to' },
  },
};

// Tier 2 — finer verbs, oriented (sourceVerb = view from source).
interface Refinement {
  readonly sourceVerb: string;
  readonly targetVerb: string;
}

type RefineKey = `${EdgeCategory}|${NodeKind}|${NodeKind}`;

function refineKey(category: EdgeCategory, sourceKind: NodeKind, targetKind: NodeKind): RefineKey {
  return `${category}|${sourceKind}|${targetKind}`;
}

const REFINE: Partial<Record<RefineKey, Refinement>> = {
  [refineKey('realization', 'requirement', 'module')]: {
    sourceVerb: 'implemented by',
    targetVerb: 'implements',
  },
  [refineKey('realization', 'interface', 'module')]: {
    sourceVerb: 'implemented by',
    targetVerb: 'implements',
  },
  [refineKey('realization', 'requirement', 'slice')]: {
    sourceVerb: 'established by',
    targetVerb: 'establishes',
  },
  [refineKey('realization', 'invariant', 'requirement')]: {
    sourceVerb: 'expressed by',
    targetVerb: 'expresses',
  },
};

export interface EdgeLabelInput {
  readonly category: EdgeCategory;
  readonly anchorRole: AnchorRole;
  readonly stance?: EdgeStance | undefined;
  /** Endpoint kinds enable Tier-2 refinement; omit to get the base heading. */
  readonly sourceKind?: NodeKind | undefined;
  readonly targetKind?: NodeKind | undefined;
}

/** Plain-language heading for an edge read from the anchor's perspective. */
export function edgeLabel(input: EdgeLabelInput): string {
  const { category, anchorRole, stance, sourceKind, targetKind } = input;

  if (sourceKind && targetKind) {
    const refinement = REFINE[refineKey(category, sourceKind, targetKind)];
    if (refinement) {
      return anchorRole === 'source' ? refinement.sourceVerb : refinement.targetVerb;
    }
  }

  return BASE[category][anchorRole][stanceKey(stance)] ?? category;
}
