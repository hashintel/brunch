import type { KnowledgeKind } from '@/shared/knowledge.js';

export interface KnowledgeDisplayGroup {
  label: string;
  kinds: KnowledgeKind[];
}

export const knowledgeDisplayGroups: KnowledgeDisplayGroup[] = [
  { label: 'Goals & Context', kinds: ['goal', 'context', 'constraint'] },
  { label: 'Terminology', kinds: ['term'] },
  { label: 'Assumptions & Decisions', kinds: ['assumption', 'decision'] },
  { label: 'Requirements', kinds: ['requirement'] },
  { label: 'Acceptance Criteria', kinds: ['criterion'] },
];

const visibleKnowledgeKinds = new Set(knowledgeDisplayGroups.flatMap((group) => group.kinds));

export function isVisibleKnowledgeKind(kind: KnowledgeKind): boolean {
  return visibleKnowledgeKinds.has(kind);
}
