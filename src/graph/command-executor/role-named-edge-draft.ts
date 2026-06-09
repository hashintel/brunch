import { EDGE_CATEGORY_METADATA } from '../policy/category-policy.js';
import type { EdgeCategory, EdgeStance } from '../schema/edges.js';
import { type BatchEdgeInput, type BatchEdgeRef } from './commit-graph-types.js';

type RoleNamedEdgeDraftByCategory = {
  readonly dependency: {
    readonly category: 'dependency';
    readonly dependency: BatchEdgeRef;
    readonly dependent: BatchEdgeRef;
    readonly rationale?: string | undefined;
  };
  readonly proof: {
    readonly category: 'proof';
    readonly oracle: BatchEdgeRef;
    readonly claim: BatchEdgeRef;
    readonly stance: EdgeStance;
    readonly rationale?: string | undefined;
  };
  readonly support: {
    readonly category: 'support';
    readonly support: BatchEdgeRef;
    readonly claim: BatchEdgeRef;
    readonly stance: EdgeStance;
    readonly rationale?: string | undefined;
  };
  readonly realization: {
    readonly category: 'realization';
    readonly abstract: BatchEdgeRef;
    readonly concrete: BatchEdgeRef;
    readonly rationale?: string | undefined;
  };
  readonly boundary: {
    readonly category: 'boundary';
    readonly boundary: BatchEdgeRef;
    readonly subject: BatchEdgeRef;
    readonly rationale?: string | undefined;
  };
  readonly composition: {
    readonly category: 'composition';
    readonly whole: BatchEdgeRef;
    readonly part: BatchEdgeRef;
    readonly rationale?: string | undefined;
  };
  readonly association: {
    readonly category: 'association';
    readonly a: BatchEdgeRef;
    readonly b: BatchEdgeRef;
    readonly rationale?: string | undefined;
  };
  readonly supersession: {
    readonly category: 'supersession';
    readonly successor: BatchEdgeRef;
    readonly predecessor: BatchEdgeRef;
    readonly rationale?: string | undefined;
  };
};

export type RoleNamedEdgeDraft = RoleNamedEdgeDraftByCategory[EdgeCategory];

type NonAssociationCategory = Exclude<EdgeCategory, 'association'>;
type NonAssociationRoleNamedEdgeDraft = Exclude<RoleNamedEdgeDraft, { readonly category: 'association' }>;

function assertStanceLocality(draft: RoleNamedEdgeDraft): void {
  if (draft.category === 'proof' || draft.category === 'support') {
    if (draft.stance !== 'for' && draft.stance !== 'against') {
      throw new Error(`${draft.category} edges require stance "for" or "against".`);
    }
    return;
  }

  if ('stance' in draft && draft.stance !== undefined) {
    throw new Error(`${draft.category} edges do not accept stance.`);
  }
}

function normalizeNonAssociationEdgeDraft(draft: NonAssociationRoleNamedEdgeDraft): BatchEdgeInput {
  const metadata = EDGE_CATEGORY_METADATA[draft.category as NonAssociationCategory];
  const source = draft[metadata.sourceRole as keyof typeof draft] as BatchEdgeRef;
  const target = draft[metadata.targetRole as keyof typeof draft] as BatchEdgeRef;

  return {
    category: draft.category,
    source,
    target,
    ...(draft.category === 'proof' || draft.category === 'support' ? { stance: draft.stance } : {}),
    ...(draft.rationale === undefined ? {} : { rationale: draft.rationale }),
  };
}

export function normalizeRoleNamedEdgeDraft(draft: RoleNamedEdgeDraft): BatchEdgeInput {
  assertStanceLocality(draft);

  if (draft.category === 'association') {
    return {
      category: draft.category,
      source: draft.a,
      target: draft.b,
      ...(draft.rationale === undefined ? {} : { rationale: draft.rationale }),
    };
  }

  return normalizeNonAssociationEdgeDraft(draft);
}

export function roleNamedEdgeDraftFromBatchEdgeInput(input: BatchEdgeInput): RoleNamedEdgeDraft {
  const metadata = EDGE_CATEGORY_METADATA[input.category as EdgeCategory];

  if (input.category === 'association') {
    return {
      category: 'association',
      a: input.source,
      b: input.target,
      ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    };
  }

  const draft = {
    category: input.category,
    [metadata.sourceRole]: input.source,
    [metadata.targetRole]: input.target,
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    ...(input.stance === undefined ? {} : { stance: input.stance }),
  };

  return draft as RoleNamedEdgeDraft;
}
