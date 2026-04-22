import { describe, expect, it } from 'vitest';

import {
  createKnowledgeReferenceCode,
  knowledgeCollectionKeyByKind,
  knowledgeEntityCollectionByKind,
  knowledgeEntityCollections,
  knowledgeKindDurabilityPolicies,
  knowledgeKindReferencePrefixes,
  knowledgeKindRegistry,
  knowledgeKindSemanticRoles,
  knowledgeKinds,
  observerPhaseOntologyPolicies,
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
        entityCollection: 'knowledge_item',
        referenceCodePrefix: 'D',
      },
      {
        kind: 'assumption',
        collectionKey: 'assumptions',
        label: 'Assumptions',
        contextHeading: 'Existing Assumptions',
        emptyStateCopy: "No assumptions yet. They'll appear as the interview progresses.",
        entityCollection: 'knowledge_item',
        referenceCodePrefix: 'A',
      },
    ]);
  });

  it('exports canonical kind, collection, and reference-code metadata', () => {
    expect(knowledgeKinds).toEqual(knowledgeKindRegistry.map((entry) => entry.kind));
    expect(knowledgeEntityCollections).toEqual(['knowledge_item']);
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
      decision: 'knowledge_item',
      assumption: 'knowledge_item',
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

  it('exports semantic roles for every canonical knowledge kind', () => {
    expect(Object.keys(knowledgeKindSemanticRoles)).toEqual(knowledgeKinds);
    expect(knowledgeKindSemanticRoles).toEqual({
      goal: 'desired project outcome or target state',
      term: 'domain language that needs stable shared meaning',
      context: 'situational truth, actors, workflows, or bounded area under discussion',
      constraint: 'boundary on acceptable scope or solution space, including non-goals',
      requirement: 'must-do capability or obligation the product needs to satisfy',
      criterion: 'verifiable success condition or observable check that proves a requirement is satisfied',
      decision: 'explicit commitment about the chosen approach',
      assumption: 'supporting belief that could later prove false',
    });
  });

  it('declares observer phase ontology policy in one shared place', () => {
    expect(observerPhaseOntologyPolicies.grounding).toEqual({
      focusKinds: ['goal', 'term', 'context', 'constraint'],
      allowedKinds: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption'],
      correctionKinds: [],
    });
    expect(observerPhaseOntologyPolicies.design).toEqual({
      focusKinds: ['decision', 'assumption'],
      allowedKinds: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption'],
      correctionKinds: ['goal', 'term', 'context', 'constraint'],
    });
    expect(observerPhaseOntologyPolicies.requirements).toEqual({
      focusKinds: ['requirement'],
      allowedKinds: ['goal', 'term', 'context', 'constraint', 'requirement'],
      correctionKinds: ['goal', 'term', 'context', 'constraint'],
      deferredKinds: ['criterion'],
    });
    expect(observerPhaseOntologyPolicies.criteria).toEqual({
      focusKinds: ['criterion'],
      allowedKinds: ['goal', 'term', 'context', 'constraint', 'criterion'],
      correctionKinds: ['goal', 'term', 'context', 'constraint'],
    });
  });

  it('makes requirement and criterion durability authority explicit', () => {
    expect(knowledgeKindDurabilityPolicies).toEqual({
      goal: { authority: 'observer_capture', family: 'exploration', reviewPhase: null },
      term: { authority: 'observer_capture', family: 'exploration', reviewPhase: null },
      context: { authority: 'observer_capture', family: 'exploration', reviewPhase: null },
      constraint: { authority: 'observer_capture', family: 'exploration', reviewPhase: null },
      requirement: { authority: 'accepted_review', family: 'review', reviewPhase: 'requirements' },
      criterion: { authority: 'accepted_review', family: 'review', reviewPhase: 'criteria' },
      decision: { authority: 'observer_capture', family: 'exploration', reviewPhase: null },
      assumption: { authority: 'observer_capture', family: 'exploration', reviewPhase: null },
    });
  });
});
