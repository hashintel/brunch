import type { EntitiesData } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

const SPEC_ID = 1;

function emptyEntities(): EntitiesData {
  return {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  };
}

export function emptySpec(): EntitiesData {
  return emptyEntities();
}

export function singleItemNoEdges(): EntitiesData {
  return {
    ...emptyEntities(),
    goals: [
      {
        id: 1,
        specification_id: SPEC_ID,
        kind: 'goal',
        subtype: null,
        content: 'Reduce signup drop-off',
        rationale: null,
        referenceCode: createKnowledgeReferenceCode('goal', 1),
      },
    ],
  };
}

export function crossPhaseDecisionLink(): EntitiesData {
  const entities = emptyEntities();

  entities.goals = [
    {
      id: 10,
      specification_id: SPEC_ID,
      kind: 'goal',
      subtype: null,
      content: 'Reduce signup drop-off',
      rationale: 'Conversion funnel telemetry shows 38% abandonment at password creation.',
      referenceCode: createKnowledgeReferenceCode('goal', 1),
    },
  ];
  entities.constraints = [
    {
      id: 20,
      specification_id: SPEC_ID,
      kind: 'constraint',
      subtype: null,
      content: 'GDPR territory restrictions',
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('constraint', 1),
    },
  ];
  entities.decisions = [
    {
      id: 30,
      specification_id: SPEC_ID,
      content: 'Magic-link authentication',
      rationale: 'Lower friction than passwords for returning users.',
      referenceCode: createKnowledgeReferenceCode('decision', 1),
    },
  ];
  entities.requirements = [
    {
      id: 40,
      specification_id: SPEC_ID,
      kind: 'requirement',
      subtype: null,
      content: 'Email verification on first login',
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('requirement', 1),
    },
  ];

  entities.relationships = [
    {
      type: 'refines',
      source: { kind: 'decision', collection: 'knowledge_item', id: 30 },
      target: { kind: 'goal', collection: 'knowledge_item', id: 10 },
    },
    {
      type: 'constrains',
      source: { kind: 'constraint', collection: 'knowledge_item', id: 20 },
      target: { kind: 'decision', collection: 'knowledge_item', id: 30 },
    },
    {
      type: 'derived_from',
      source: { kind: 'requirement', collection: 'knowledge_item', id: 40 },
      target: { kind: 'decision', collection: 'knowledge_item', id: 30 },
    },
  ];

  return entities;
}

export function denseGoalAnchor(): EntitiesData {
  const entities = emptyEntities();
  const goalId = 100;

  entities.goals = [
    {
      id: goalId,
      specification_id: SPEC_ID,
      kind: 'goal',
      subtype: null,
      content: 'Ship the product end-to-end',
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('goal', 1),
    },
  ];

  const decisionCount = 15;
  entities.decisions = Array.from({ length: decisionCount }, (_, index) => {
    const id = 200 + index;
    return {
      id,
      specification_id: SPEC_ID,
      content: `Decision number ${index + 1}`,
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('decision', index + 1),
    };
  });

  entities.relationships = entities.decisions.map((decision) => ({
    type: 'refines' as const,
    source: { kind: 'decision' as const, collection: 'knowledge_item' as const, id: decision.id },
    target: { kind: 'goal' as const, collection: 'knowledge_item' as const, id: goalId },
  }));

  return entities;
}

export function activePathDivergence(): EntitiesData {
  const entities = emptyEntities();

  entities.goals = [
    {
      id: 1,
      specification_id: SPEC_ID,
      kind: 'goal',
      subtype: null,
      content: 'On-path goal',
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('goal', 1),
    },
    {
      id: 2,
      specification_id: SPEC_ID,
      kind: 'goal',
      subtype: null,
      content: 'Off-path goal',
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('goal', 2),
    },
  ];
  entities.decisions = [
    {
      id: 3,
      specification_id: SPEC_ID,
      content: 'On-path decision',
      rationale: null,
      referenceCode: createKnowledgeReferenceCode('decision', 1),
    },
  ];
  entities.relationships = [
    {
      type: 'refines',
      source: { kind: 'decision', collection: 'knowledge_item', id: 3 },
      target: { kind: 'goal', collection: 'knowledge_item', id: 1 },
    },
  ];

  return entities;
}
