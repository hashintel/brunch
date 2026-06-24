import { EDGE_CATEGORY_METADATA } from '../policy/category-policy.js';
import type { EdgeCategory, EdgeStance } from '../schema/edges.js';
import type { CreateGraphEdgeInput, GraphMutationNodeRef } from './graph-mutation-types.js';

type RoleNamedEdgeDraftByCategory<Ref> = {
  readonly dependency: {
    readonly category: 'dependency';
    readonly dependency: Ref;
    readonly dependent: Ref;
    readonly rationale?: string | undefined;
  };
  readonly witness: {
    readonly category: 'witness';
    readonly oracle: Ref;
    readonly claim: Ref;
    readonly stance: EdgeStance;
    readonly rationale?: string | undefined;
  };
  readonly rationale: {
    readonly category: 'rationale';
    readonly support: Ref;
    readonly claim: Ref;
    readonly stance: EdgeStance;
    readonly rationale?: string | undefined;
  };
  readonly realization: {
    readonly category: 'realization';
    readonly abstract: Ref;
    readonly concrete: Ref;
    readonly rationale?: string | undefined;
  };
  readonly refinement: {
    readonly category: 'refinement';
    readonly abstract: Ref;
    readonly concrete: Ref;
    readonly rationale?: string | undefined;
  };
  readonly exclusion: {
    readonly category: 'exclusion';
    readonly boundary: Ref;
    readonly subject: Ref;
    readonly rationale?: string | undefined;
  };
  readonly composition: {
    readonly category: 'composition';
    readonly whole: Ref;
    readonly part: Ref;
    readonly rationale?: string | undefined;
  };
  readonly cross_reference: {
    readonly category: 'cross_reference';
    readonly a: Ref;
    readonly b: Ref;
    readonly rationale?: string | undefined;
  };
  readonly supersession: {
    readonly category: 'supersession';
    readonly successor: Ref;
    readonly predecessor: Ref;
    readonly rationale?: string | undefined;
  };
};

export type RoleNamedEdgeDraftOf<Ref> = RoleNamedEdgeDraftByCategory<Ref>[EdgeCategory];
export type RoleNamedEdgeDraft = RoleNamedEdgeDraftOf<GraphMutationNodeRef>;

type NonCrossReferenceRoleNamedEdgeDraft = Exclude<
  RoleNamedEdgeDraft,
  { readonly category: 'cross_reference' }
>;

export function authoredEdgeEndpointFields(category: EdgeCategory): readonly [string, string] {
  if (category === 'cross_reference') {
    return ['a', 'b'];
  }

  const metadata = EDGE_CATEGORY_METADATA[category];
  if (!metadata) {
    throw new Error(`unknown edge category "${String(category)}"`);
  }
  return [metadata.sourceRole, metadata.targetRole];
}

function assertStanceLocality(draft: RoleNamedEdgeDraft): void {
  const metadata = EDGE_CATEGORY_METADATA[draft.category];
  if (metadata.stanceRequired) {
    if (!('stance' in draft) || (draft.stance !== 'for' && draft.stance !== 'against')) {
      throw new Error(`${draft.category} edges require stance "for" or "against".`);
    }
    return;
  }

  if ('stance' in draft && draft.stance !== undefined) {
    throw new Error(`${draft.category} edges do not accept stance.`);
  }
}

function normalizeNonCrossReferenceEdgeDraft(
  draft: NonCrossReferenceRoleNamedEdgeDraft,
): CreateGraphEdgeInput {
  const { source, target } = roleNamedEdgeDraftEndpoints(draft);

  return {
    category: draft.category,
    source,
    target,
    ...(EDGE_CATEGORY_METADATA[draft.category].stanceRequired && 'stance' in draft
      ? { stance: draft.stance }
      : {}),
    ...(draft.rationale === undefined ? {} : { rationale: draft.rationale }),
  };
}

export function normalizeRoleNamedEdgeDraft(draft: RoleNamedEdgeDraft): CreateGraphEdgeInput {
  assertStanceLocality(draft);

  if (draft.category === 'cross_reference') {
    return {
      category: draft.category,
      source: draft.a,
      target: draft.b,
      ...(draft.rationale === undefined ? {} : { rationale: draft.rationale }),
    };
  }

  return normalizeNonCrossReferenceEdgeDraft(draft);
}

export function roleNamedEdgeDraftEndpoints<Ref>(draft: RoleNamedEdgeDraftOf<Ref>): {
  readonly source: Ref;
  readonly target: Ref;
} {
  const [sourceField, targetField] = authoredEdgeEndpointFields(draft.category);
  return {
    source: draft[sourceField as keyof typeof draft] as Ref,
    target: draft[targetField as keyof typeof draft] as Ref,
  };
}

export function roleNamedEdgeDraftFromCreateEdgeInput(input: CreateGraphEdgeInput): RoleNamedEdgeDraft {
  const [sourceField, targetField] = authoredEdgeEndpointFields(input.category as EdgeCategory);

  const draft = {
    category: input.category,
    [sourceField]: input.source,
    [targetField]: input.target,
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    ...(input.stance === undefined ? {} : { stance: input.stance }),
  };

  return draft as RoleNamedEdgeDraft;
}
