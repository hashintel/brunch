import { describe, expect, it } from 'vitest';

import { knowledgeKindRegistry } from './knowledge.js';

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
    ]);
  });
});
