export const INTENT_KINDS = [
  'goal',
  'thesis',
  'term',
  'context',
  'story',
  'unknown',
  'requirement',
  'assumption',
  'constraint',
  'invariant',
  'decision',
  'criterion',
  'example',
] as const;

export const ORACLE_KINDS = ['check', 'vv_method', 'evidence', 'vv_obligation'] as const;

export const DESIGN_KINDS = ['module', 'interface', 'entity', 'sketch'] as const;

export const PLAN_KINDS = ['milestone', 'frontier', 'slice'] as const;

/** Every node kind across the four planes, in plane order — the canonical all-kinds array. */
export const NODE_KINDS = [...INTENT_KINDS, ...ORACLE_KINDS, ...DESIGN_KINDS, ...PLAN_KINDS] as const;

/**
 * Spec scope — an ownership relation to the codebase (D89-L), resolved outside
 * the node graph on the spec row, not as a node kind. `product` owns the whole
 * codebase; `feature` owns a part and a cycle within a brownfield codebase;
 * `function` captures (often formal) verification around a focused area.
 */
export const SPEC_KINDS = ['product', 'feature', 'function'] as const;

export type SpecKind = (typeof SPEC_KINDS)[number];

export const NODE_PLANES = ['intent', 'oracle', 'design', 'plan'] as const;

export const NODE_BASES = ['explicit', 'implicit'] as const;

/**
 * Whether a graph item has been harmonized against inner-band concerns
 * (`settled`) or is still reviewed-but-unharmonized signal (`advisory`).
 *
 * Orthogonal to `NODE_BASES` (I52-L): `basis` records approval strength,
 * `settlement` records harmonization state. Applies to both nodes and edges,
 * mirroring `NODE_BASES`'s scope.
 */
export const NODE_SETTLEMENTS = ['advisory', 'settled'] as const;

export const EDGE_CATEGORIES = [
  'dependency',
  'witness',
  'rationale',
  'realization',
  'refinement',
  'exclusion',
  'composition',
  'cross_reference',
  'supersession',
] as const;

export const EDGE_STANCES = ['for', 'against'] as const;

export const READINESS_BANDS = ['grounding', 'elicitation', 'projection', 'commitment'] as const;
export type ReadinessBand = (typeof READINESS_BANDS)[number];
