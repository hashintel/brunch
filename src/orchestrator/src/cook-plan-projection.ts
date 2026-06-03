import type { Plan } from './types.js';

/**
 * Structural snapshot of the relevant portion of a completed brunch
 * specification's intent graph. Declared locally so the orchestrator
 * package does not import from `@/server/*`; the server-side snapshot
 * builder is a separate slice.
 */
export interface CompletedSpecSnapshot {
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

export function projectCookPlanFromSpec(snapshot: CompletedSpecSnapshot): Plan {
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
      id: `req-${requirement.kindOrdinal}`,
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
  return a.kindOrdinal - b.kindOrdinal;
}
