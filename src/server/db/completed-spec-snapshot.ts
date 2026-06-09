// FE-800 slice 6: server-side adapter that turns a completed brunch
// specification into the orchestrator's `CompletedSpecSnapshot`.
//
// Uses the active-confirmation-path projection — accepted requirements
// + accepted criteria + relationships filtered to the active turn path
// — because the orchestrator emitter is meant to plan from the spec
// the user has confirmed, not from every draft item in the project.
//
// Edges are filtered to those whose source AND target are in the
// snapshot's accepted-id set so the orchestrator never sees dangling
// references to non-snapshot items (goals, terms, decisions, etc.).
//
// Pure type-time dependency on the orchestrator: imports
// `CompletedSpecSnapshot` as a `type` only. No runtime import path
// flows from orchestrator → server.

import type { CompletedSpecSnapshot } from '../../orchestrator/src/plan-projection.js';
import {
  getAcceptedCriterionEntitiesForSpecification,
  getAcceptedRequirementEntitiesForSpecification,
  getEntitiesForSpecificationOnActivePath,
  getCurrentWorkflowState,
  getSpecification,
} from '../db.js';
import type { DB } from '../db.js';

export function buildCompletedSpecSnapshot(db: DB, specificationId: number): CompletedSpecSnapshot {
  const requirements = getAcceptedRequirementEntitiesForSpecification(db, specificationId);
  const criteria = getAcceptedCriterionEntitiesForSpecification(db, specificationId);
  const acceptedIds = new Set<number>([
    ...requirements.map((requirement) => requirement.id),
    ...criteria.map((criterion) => criterion.id),
  ]);
  const { relationships } = getEntitiesForSpecificationOnActivePath(db, specificationId);

  return {
    // Grounding mode carried through to the plan so cook resolves the
    // worktree strategy from spec truth. Missing spec → greenfield default.
    mode: getSpecification(db, specificationId)?.mode ?? 'greenfield',
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      content: requirement.content,
      kindOrdinal: requirement.kind_ordinal,
    })),
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      content: criterion.content,
      kindOrdinal: criterion.kind_ordinal,
    })),
    edges: relationships
      .filter(
        (relationship) => acceptedIds.has(relationship.source.id) && acceptedIds.has(relationship.target.id),
      )
      .map((relationship) => ({
        fromItemId: relationship.source.id,
        toItemId: relationship.target.id,
        relation: relationship.type,
      })),
  };
}

export function assertCompletedSpecReadyForPlanning(
  db: DB,
  specificationId: number,
  snapshot: CompletedSpecSnapshot,
): void {
  if (snapshot.requirements.length === 0) {
    throw new Error(
      `specification ${specificationId} has no accepted requirements — confirm the requirements phase before planning`,
    );
  }

  if (getCurrentWorkflowState(db, specificationId).phases.criteria.status !== 'closed') {
    throw new Error(
      `specification ${specificationId} criteria are not confirmed — confirm the criteria phase before planning`,
    );
  }

  if (snapshot.criteria.length === 0) {
    throw new Error(
      `specification ${specificationId} has no accepted criteria — confirm the criteria phase before planning`,
    );
  }
}
