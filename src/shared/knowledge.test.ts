import { describe, expect, it } from 'vitest';

import {
  createKnowledgeReferenceCode,
  knowledgeCollectionKeyByKind,
  knowledgeEntityCollectionByKind,
  knowledgeEntityCollections,
  knowledgeKindReferencePrefixes,
  knowledgeKindRegistry,
  knowledgeKinds,
} from './knowledge.js';

describe('knowledge kind registry', () => {
  it('defines the eight canonical knowledge kinds with stable collection metadata in sidebar order', () => {
    expect(knowledgeKindRegistry).toMatchObject([
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
    ]);
  });

  it('exports canonical kind, collection, and reference-code metadata', () => {
    expect(knowledgeKinds).toEqual(knowledgeKindRegistry.map((entry) => entry.kind));
    expect(knowledgeEntityCollections).toEqual(['knowledge_item', 'decision', 'assumption']);
    expect(knowledgeCollectionKeyByKind).toEqual({
      goal: 'goals',
      term: 'terms',
      context: 'contexts',
      constraint: 'constraints',
      requirement: 'requirements',
      criterion: 'criteria',
      decision: 'decisions',
      assumption: 'assumptions',
    });
    expect(knowledgeEntityCollectionByKind).toEqual({
      goal: 'knowledge_item',
      term: 'knowledge_item',
      context: 'knowledge_item',
      constraint: 'knowledge_item',
      requirement: 'knowledge_item',
      criterion: 'knowledge_item',
      decision: 'decision',
      assumption: 'assumption',
    });
    expect(knowledgeKindReferencePrefixes).toEqual({
      goal: 'G',
      term: 'T',
      context: 'CTX',
      constraint: 'CON',
      requirement: 'R',
      criterion: 'AC',
      decision: 'D',
      assumption: 'A',
    });
  });

  it('derives reference codes from registry-owned per-kind prefixes', () => {
    expect(createKnowledgeReferenceCode('goal', 2)).toBe('G2');
    expect(createKnowledgeReferenceCode('term', 3)).toBe('T3');
    expect(createKnowledgeReferenceCode('context', 4)).toBe('CTX4');
    expect(createKnowledgeReferenceCode('constraint', 5)).toBe('CON5');
    expect(createKnowledgeReferenceCode('requirement', 6)).toBe('R6');
    expect(createKnowledgeReferenceCode('criterion', 7)).toBe('AC7');
    expect(createKnowledgeReferenceCode('decision', 8)).toBe('D8');
    expect(createKnowledgeReferenceCode('assumption', 9)).toBe('A9');
  });
});
