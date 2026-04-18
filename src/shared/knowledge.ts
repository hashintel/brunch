export const knowledgeKinds = [
  'goal',
  'term',
  'context',
  'constraint',
  'requirement',
  'criterion',
  'decision',
  'assumption',
] as const;

export type KnowledgeKind = (typeof knowledgeKinds)[number];

export const knowledgeCollectionKeys = [
  'goals',
  'terms',
  'contexts',
  'constraints',
  'requirements',
  'criteria',
  'decisions',
  'assumptions',
] as const;

export type KnowledgeCollectionKey = (typeof knowledgeCollectionKeys)[number];

export const knowledgeEntityCollections = ['knowledge_item', 'decision', 'assumption'] as const;

export type KnowledgeEntityCollection = (typeof knowledgeEntityCollections)[number];

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
    kind: 'goal',
    collectionKey: 'goals',
    label: 'Goals',
    contextHeading: 'Existing Goals',
    emptyStateCopy: "No goals yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
  },
  {
    kind: 'term',
    collectionKey: 'terms',
    label: 'Terms',
    contextHeading: 'Existing Terms',
    emptyStateCopy: "No terms yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
  },
  {
    kind: 'context',
    collectionKey: 'contexts',
    label: 'Context',
    contextHeading: 'Existing Context',
    emptyStateCopy: "No context items yet. They'll appear as the interview progresses.",
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

export const knowledgeCollectionKeyByKind = Object.fromEntries(
  knowledgeKindRegistry.map((entry) => [entry.kind, entry.collectionKey]),
) as {
  [K in KnowledgeKind]: Extract<KnowledgeKindMetadata, { kind: K }>['collectionKey'];
};

export const knowledgeEntityCollectionByKind = Object.fromEntries(
  knowledgeKindRegistry.map((entry) => [entry.kind, entry.entityCollection]),
) as {
  [K in KnowledgeKind]: Extract<KnowledgeKindMetadata, { kind: K }>['entityCollection'];
};

export const knowledgeKindReferencePrefixes = {
  goal: 'GOAL',
  term: 'TERM',
  context: 'CTX',
  constraint: 'CST',
  requirement: 'R',
  criterion: 'CRIT',
  decision: 'D',
  assumption: 'A',
} as const satisfies Record<KnowledgeKind, string>;

export function createKnowledgeReferenceCode(kind: KnowledgeKind, ordinal: number): string {
  return `${knowledgeKindReferencePrefixes[kind]}${ordinal}`;
}

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
