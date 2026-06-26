// FE-829 slice 3: deterministic planning context for the build-architect
// LLM stage.
//
// The build-architect (`architectPlan`) reasons in slice-id space
// (`req-<itemId>`), but the spec's relation edges live in the raw
// `CompletedSpecSnapshot` between requirement/criterion item ids. This
// module projects those edges into slice-id space so the architect can be
// handed *semantic* relation hints without recoupling it to raw graph ids.
//
// Pure and deterministic — this is the testable seam that lets slice 3
// enrich the prompt without making any model-quality claim. `verifies`
// edges are consumed only as the criterion→requirement ownership bridge
// (criteria themselves already ride on the projected plan's slices); they
// are never emitted as planning relations.

import type { CompletedSpecSnapshot, KnowledgeEdgeSnapshot } from './plan-projection.js';

/**
 * A spec relation lifted into slice-id space. `relation` excludes
 * `verifies` (consumed for ownership, not emitted). These are epistemic
 * hints, NOT execution-order edges — the planner infers real engineering
 * prerequisites from them (A97).
 */
export type PlanningRelation = {
  fromSliceId: string;
  relation: Exclude<KnowledgeEdgeSnapshot['relation'], 'verifies'>;
  toSliceId: string;
};

export type PlanningPackageContext = {
  dir: string;
  name?: string;
};

export type PlanningProjectContext = {
  packages: PlanningPackageContext[];
};

export type PlanningContext = {
  relations: PlanningRelation[];
  project?: PlanningProjectContext;
};

export const EMPTY_PLANNING_CONTEXT: PlanningContext = { relations: [] };

/**
 * Project a snapshot's relation edges into slice-id space.
 *
 * - A requirement item `N` maps to slice `req-N`.
 * - A criterion item maps to its owning requirement via `verifies`.
 * - Non-`verifies` edges whose endpoints both resolve to a requirement
 *   owner become `req-<from> --relation--> req-<to>`.
 * - Unresolved endpoints and self-edges are dropped; relations are
 *   deduped and stable-sorted.
 */
export function projectPlanningContext(snapshot: CompletedSpecSnapshot): PlanningContext {
  const requirementIds = new Set(snapshot.requirements.map((requirement) => requirement.id));

  const criterionOwnerById = new Map<number, number>();
  for (const edge of snapshot.edges) {
    if (edge.relation !== 'verifies') continue;
    if (!requirementIds.has(edge.toItemId)) continue;
    criterionOwnerById.set(edge.fromItemId, edge.toItemId);
  }

  const resolveOwner = (itemId: number): number | undefined =>
    requirementIds.has(itemId) ? itemId : criterionOwnerById.get(itemId);

  const seen = new Set<string>();
  const relations: PlanningRelation[] = [];

  for (const edge of snapshot.edges) {
    if (edge.relation === 'verifies') continue;

    const fromReq = resolveOwner(edge.fromItemId);
    const toReq = resolveOwner(edge.toItemId);
    if (fromReq === undefined || toReq === undefined) continue;

    const fromSliceId = `req-${fromReq}`;
    const toSliceId = `req-${toReq}`;
    if (fromSliceId === toSliceId) continue;

    const key = `${fromSliceId}|${edge.relation}|${toSliceId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    relations.push({ fromSliceId, relation: edge.relation, toSliceId });
  }

  relations.sort(
    (a, b) =>
      a.fromSliceId.localeCompare(b.fromSliceId) ||
      a.relation.localeCompare(b.relation) ||
      a.toSliceId.localeCompare(b.toSliceId),
  );

  return { relations };
}
