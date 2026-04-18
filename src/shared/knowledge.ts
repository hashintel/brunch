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
  referenceCodePrefix: string;
}

export const knowledgeKindRegistry = [
  {
    kind: 'goal',
    collectionKey: 'goals',
    label: 'Goals',
    contextHeading: 'Existing Goals',
    emptyStateCopy: "No goals yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
    referenceCodePrefix: 'G',
  },
  {
    kind: 'term',
    collectionKey: 'terms',
    label: 'Terms',
    contextHeading: 'Existing Terms',
    emptyStateCopy: "No terms yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
    referenceCodePrefix: 'T',
  },
  {
    kind: 'context',
    collectionKey: 'contexts',
    label: 'Context',
    contextHeading: 'Existing Context',
    emptyStateCopy: "No context items yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
    referenceCodePrefix: 'CTX',
  },
  {
    kind: 'constraint',
    collectionKey: 'constraints',
    label: 'Constraints',
    contextHeading: 'Existing Constraints',
    emptyStateCopy: "No constraints yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
    referenceCodePrefix: 'CON',
  },
  {
    kind: 'requirement',
    collectionKey: 'requirements',
    label: 'Requirements',
    contextHeading: 'Existing Requirements',
    emptyStateCopy: "No requirements yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
    referenceCodePrefix: 'R',
  },
  {
    kind: 'criterion',
    collectionKey: 'criteria',
    label: 'Criteria',
    contextHeading: 'Existing Criteria',
    emptyStateCopy: "No criteria yet. They'll appear as the interview progresses.",
    entityCollection: 'knowledge_item',
    referenceCodePrefix: 'AC',
  },
  {
    kind: 'decision',
    collectionKey: 'decisions',
    label: 'Decisions',
    contextHeading: 'Existing Decisions',
    emptyStateCopy: "No decisions yet. They'll appear as the interview progresses.",
    entityCollection: 'decision',
    referenceCodePrefix: 'D',
  },
  {
    kind: 'assumption',
    collectionKey: 'assumptions',
    label: 'Assumptions',
    contextHeading: 'Existing Assumptions',
    emptyStateCopy: "No assumptions yet. They'll appear as the interview progresses.",
    entityCollection: 'assumption',
    referenceCodePrefix: 'A',
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

export const knowledgeKindRegistryByKind = Object.fromEntries(
  knowledgeKindRegistry.map((entry) => [entry.kind, entry]),
) as {
  [K in KnowledgeKind]: Extract<KnowledgeKindMetadata, { kind: K }>;
};

export const knowledgeKindReferencePrefixes = Object.fromEntries(
  knowledgeKindRegistry.map((entry) => [entry.kind, entry.referenceCodePrefix]),
) as {
  [K in KnowledgeKind]: Extract<KnowledgeKindMetadata, { kind: K }>['referenceCodePrefix'];
};

export const knowledgeKindSemanticRoles = {
  goal: 'desired project outcome or target state',
  term: 'domain language that needs stable shared meaning',
  context: 'situational truth, actors, workflows, or bounded area under discussion',
  constraint: 'boundary on acceptable scope or solution space, including non-goals',
  requirement: 'must-do capability or obligation the product needs to satisfy',
  criterion: 'verifiable success condition or observable check that proves a requirement is satisfied',
  decision: 'explicit commitment about the chosen approach',
  assumption: 'supporting belief that could later prove false',
} as const satisfies { [K in KnowledgeKind]: string };

export type ObserverPhase = 'scope' | 'design' | 'requirements' | 'criteria';

export interface ObserverPhaseOntologyPolicy {
  focusKinds: readonly KnowledgeKind[];
  allowedKinds: readonly KnowledgeKind[];
  correctionKinds: readonly KnowledgeKind[];
  deferredKinds?: readonly KnowledgeKind[];
}

export const observerPhaseOntologyPolicies = {
  scope: {
    focusKinds: ['goal', 'term', 'context', 'constraint'],
    allowedKinds: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption'],
    correctionKinds: [],
  },
  design: {
    focusKinds: ['decision', 'assumption'],
    allowedKinds: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption'],
    correctionKinds: ['goal', 'term', 'context', 'constraint'],
  },
  requirements: {
    focusKinds: ['requirement'],
    allowedKinds: ['goal', 'term', 'context', 'constraint', 'requirement'],
    correctionKinds: ['goal', 'term', 'context', 'constraint'],
    deferredKinds: ['criterion'],
  },
  criteria: {
    focusKinds: ['criterion'],
    allowedKinds: ['goal', 'term', 'context', 'constraint', 'criterion'],
    correctionKinds: ['goal', 'term', 'context', 'constraint'],
  },
} as const satisfies Record<ObserverPhase, ObserverPhaseOntologyPolicy>;

export function createKnowledgeReferenceCode(kind: KnowledgeKind, ordinal: number): string {
  return `${knowledgeKindRegistryByKind[kind].referenceCodePrefix}${ordinal}`;
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
