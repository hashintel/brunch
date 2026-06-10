export const INTENT_KINDS = [
  'goal',
  'thesis',
  'term',
  'context',
  'requirement',
  'assumption',
  'constraint',
  'invariant',
  'decision',
  'criterion',
  'example',
] as const;

export const ORACLE_KINDS = ['check', 'validation_method', 'evidence', 'obligation'] as const;

export const DESIGN_KINDS = ['module', 'interface'] as const;

export const PLAN_KINDS = ['milestone', 'frontier', 'slice'] as const;

export const NODE_PLANES = ['intent', 'oracle', 'design', 'plan'] as const;

export const NODE_BASES = ['explicit', 'implicit'] as const;

export const EDGE_CATEGORIES = [
  'dependency',
  'proof',
  'support',
  'realization',
  'boundary',
  'composition',
  'association',
  'supersession',
] as const;

export const EDGE_STANCES = ['for', 'against'] as const;

export const READINESS_BANDS = ['grounding', 'elicitation', 'commitment'] as const;

export const LENS_AFFINITIES = ['intent', 'design', 'oracle'] as const;

export const GAP_DISPOSITIONS = ['open', 'answered', 'not_applicable', 'irrelevant', 'reopened'] as const;

export const GAP_PREDICATE_KINDS = ['presence', 'field', 'coverage', 'manual'] as const;
