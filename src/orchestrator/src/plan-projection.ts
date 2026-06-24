import type { ProfileId } from './project-profile.js';
import type { Plan, PlanMode, PlanSpec } from './types.js';

/**
 * Structural snapshot of the relevant portion of a completed brunch
 * specification's intent graph. Declared locally so the orchestrator
 * package does not import from `@/server/*`; the server-side snapshot
 * builder is a separate slice.
 */
export interface CompletedSpecSnapshot {
  /**
   * The specification's DB id. Carried onto the emitted plan's `spec` block
   * (`spec_id`) so a cook run can be projected back onto the spec without a
   * DB read (FE-885). Absent → no `Plan.spec` is emitted (authored/legacy
   * snapshots that have no spec identity).
   */
  specId?: number;
  /**
   * The specification's grounding mode. Carried onto the emitted plan so
   * `brunch cook` resolves the worktree strategy from plan truth rather
   * than file location. Absent → `greenfield` (authored/legacy snapshots).
   */
  mode?: PlanMode;
  /**
   * The specification's toolchain profile. Carried onto the emitted plan so
   * the emitter and `brunch cook` resolve the same `Toolchain`. Absent →
   * the bun default (see `resolveToolchain`).
   */
  profile?: ProfileId;
  requirements: readonly KnowledgeItemSnapshot[];
  criteria: readonly KnowledgeItemSnapshot[];
  edges: readonly KnowledgeEdgeSnapshot[];
}

export interface KnowledgeItemSnapshot {
  id: number;
  content: string;
  kindOrdinal: number;
}

export interface KnowledgeEdgeSnapshot {
  fromItemId: number;
  toItemId: number;
  relation: 'depends_on' | 'derived_from' | 'constrains' | 'verifies' | 'refines';
}

const DEFAULT_EPIC_ID = 'default';
const DEFAULT_EPIC_SUMMARY = 'All requirements';

export function projectPlanFromSpec(snapshot: CompletedSpecSnapshot): Plan {
  const orderedRequirements = [...snapshot.requirements].sort(byKindOrdinal);
  const criteriaById = new Map(snapshot.criteria.map((criterion) => [criterion.id, criterion]));

  const verifiersByRequirementId = new Map<number, KnowledgeItemSnapshot[]>();
  for (const edge of snapshot.edges) {
    if (edge.relation !== 'verifies') continue;
    const criterion = criteriaById.get(edge.fromItemId);
    if (!criterion) continue;
    const existing = verifiersByRequirementId.get(edge.toItemId) ?? [];
    existing.push(criterion);
    verifiersByRequirementId.set(edge.toItemId, existing);
  }

  const slices = orderedRequirements.map((requirement) => {
    const verifiers = (verifiersByRequirementId.get(requirement.id) ?? []).sort(byKindOrdinal);
    return {
      id: `req-${requirement.id}`,
      epic_id: DEFAULT_EPIC_ID,
      definition: requirement.content,
      depends_on: [],
      verification: verifiers.map((criterion) => ({
        kind: 'criterion',
        target: criterion.content,
      })),
    };
  });

  return {
    mode: snapshot.mode ?? 'greenfield',
    profile: snapshot.profile,
    epics: [
      {
        id: DEFAULT_EPIC_ID,
        summary: DEFAULT_EPIC_SUMMARY,
        depends_on: [],
        verification: [],
      },
    ],
    slices,
  };
}

function byKindOrdinal(a: KnowledgeItemSnapshot, b: KnowledgeItemSnapshot): number {
  return a.kindOrdinal - b.kindOrdinal || a.id - b.id;
}

/** Requirement item id in slice-id space — matches `Slice.derived_from`. */
export function requirementItemId(requirementId: number): string {
  return `req-${requirementId}`;
}

/** Criterion item id in slice-id space. */
export function criterionItemId(criterionId: number): string {
  return `crit-${criterionId}`;
}

/**
 * Build the `Plan.spec` provenance block from a completed-spec snapshot
 * (FE-885). Normalizes requirements + criteria into slice-id space
 * (`req-<id>` / `crit-<id>`) with an embedded prose `content` snapshot and
 * `verifies` edges, so a cook run can be projected back onto the spec without
 * a DB read. Returns `undefined` when the snapshot has no `specId` (authored /
 * legacy snapshots with no spec identity). Inert to execution.
 */
export function buildPlanSpec(snapshot: CompletedSpecSnapshot): PlanSpec | undefined {
  if (snapshot.specId === undefined) return undefined;

  const verifiesByCriterionId = new Map<number, string[]>();
  for (const edge of snapshot.edges) {
    if (edge.relation !== 'verifies') continue;
    const existing = verifiesByCriterionId.get(edge.fromItemId) ?? [];
    existing.push(requirementItemId(edge.toItemId));
    verifiesByCriterionId.set(edge.fromItemId, existing);
  }

  const requirements = [...snapshot.requirements].sort(byKindOrdinal).map((requirement) => ({
    item_id: requirementItemId(requirement.id),
    content: requirement.content,
  }));
  const criteria = [...snapshot.criteria].sort(byKindOrdinal).map((criterion) => ({
    item_id: criterionItemId(criterion.id),
    content: criterion.content,
    verifies: verifiesByCriterionId.get(criterion.id) ?? [],
  }));

  return { spec_id: String(snapshot.specId), requirements, criteria };
}
