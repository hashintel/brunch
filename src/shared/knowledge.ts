export type KnowledgeKind =
  | 'framing'
  | 'constraint'
  | 'requirement'
  | 'criterion'
  | 'decision'
  | 'assumption';

export type KnowledgeCollectionKey =
  | 'framing'
  | 'constraints'
  | 'requirements'
  | 'criteria'
  | 'decisions'
  | 'assumptions';

export type KnowledgeEntityCollection = 'knowledge_item' | 'decision' | 'assumption';

export interface KnowledgeKindRegistryEntry {
  kind: KnowledgeKind;
  collectionKey: KnowledgeCollectionKey;
  label: string;
  contextHeading: string;
  emptyStateCopy: string;
  entityCollection: KnowledgeEntityCollection;
}

export const knowledgeKindRegistry = [
  {
    kind: 'framing',
    collectionKey: 'framing',
    label: 'Framing',
    contextHeading: 'Existing Framing',
    emptyStateCopy: "No framing items yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
  },
  {
    kind: 'constraint',
    collectionKey: 'constraints',
    label: 'Constraints',
    contextHeading: 'Existing Constraints',
    emptyStateCopy: "No constraints yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
  },
  {
    kind: 'requirement',
    collectionKey: 'requirements',
    label: 'Requirements',
    contextHeading: 'Existing Requirements',
    emptyStateCopy: "No requirements yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
  },
  {
    kind: 'criterion',
    collectionKey: 'criteria',
    label: 'Criteria',
    contextHeading: 'Existing Criteria',
    emptyStateCopy: "No criteria yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
  },
  {
    kind: 'decision',
    collectionKey: 'decisions',
    label: 'Decisions',
    contextHeading: 'Existing Decisions',
    emptyStateCopy: "No decisions yet. They'll appear as the interview progresses.",
    entityCollection: 'decision',
  },
  {
    kind: 'assumption',
    collectionKey: 'assumptions',
    label: 'Assumptions',
    contextHeading: 'Existing Assumptions',
    emptyStateCopy: "No assumptions yet. They'll appear as the interview progresses.",
    entityCollection: 'assumption',
  },
] as const satisfies readonly KnowledgeKindRegistryEntry[];

export type KnowledgeKindMetadata = (typeof knowledgeKindRegistry)[number];
export type GenericKnowledgeKindMetadata = Extract<
  KnowledgeKindMetadata,
  { entityCollection: 'knowledge_item' }
>;
export type GenericKnowledgeKind = GenericKnowledgeKindMetadata['kind'];
export type GenericKnowledgeCollectionKey = GenericKnowledgeKindMetadata['collectionKey'];

export const knowledgeCollectionKeys = knowledgeKindRegistry.map(
  (entry) => entry.collectionKey,
) as KnowledgeCollectionKey[];

export const genericKnowledgeKindRegistry = knowledgeKindRegistry.filter(
  (entry): entry is GenericKnowledgeKindMetadata => entry.entityCollection === 'knowledge_item',
);

export const knowledgeKindRegistryByCollectionKey = Object.fromEntries(
  knowledgeKindRegistry.map((entry) => [entry.collectionKey, entry]),
) as {
  [K in KnowledgeCollectionKey]: Extract<KnowledgeKindMetadata, { collectionKey: K }>;
};

export function createKnowledgeCollectionRecord<T>(createValue: (entry: KnowledgeKindMetadata) => T): {
  [K in KnowledgeCollectionKey]: T;
} {
  return Object.fromEntries(
    knowledgeKindRegistry.map((entry) => [entry.collectionKey, createValue(entry)]),
  ) as { [K in KnowledgeCollectionKey]: T };
}
