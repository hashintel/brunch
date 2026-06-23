import { describe, expect, it } from 'vitest';

import { crossPhaseDecisionLink, emptySpec } from '@/client/__fixtures__/graph-view.js';
import { buildGraphModel } from '@/client/components/graph/buildGraphModel.js';
import type { GraphNodeKind } from '@/client/components/graph/types.js';
import type { EntitiesData } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

const SPEC_ID = 1;

/**
 * Nodes are keyed by `${kind}:${id}` (mirrors the list view's projection), so
 * a source item maps to its node by the same rule.
 */
function nodeId(kind: GraphNodeKind, id: number): string {
  return `${kind}:${id}`;
}

function nodesById(model: ReturnType<typeof buildGraphModel>) {
  return new Map(model.nodes.map((node) => [node.id, node]));
}

/**
 * One item per descriptor field we care about, with deliberately distinct
 * reference codes, content and rationale so each projected value can only be
 * satisfied by reading the right source field:
 *   - goal(1):        rationale present
 *   - constraint(4):  rationale explicitly null  -> must project as ''
 *   - decision(7):    no `kind` field, rationale present
 *   - assumption(8):  no `kind` and no `rationale` field -> rationale ''
 */
function descriptorFixture(): EntitiesData {
  return {
    ...emptySpec(),
    goals: [
      {
        id: 1,
        specification_id: SPEC_ID,
        kind: 'goal',
        subtype: null,
        content: 'Reduce signup drop-off',
        rationale: 'Telemetry shows 38% abandonment at password creation.',
        referenceCode: 'G1',
      },
    ],
    constraints: [
      {
        id: 4,
        specification_id: SPEC_ID,
        kind: 'constraint',
        subtype: null,
        content: 'GDPR territory restrictions',
        rationale: null,
        referenceCode: 'CON1',
      },
    ],
    decisions: [
      {
        id: 7,
        specification_id: SPEC_ID,
        content: 'Magic-link authentication',
        rationale: 'Lower friction than passwords for returning users.',
        referenceCode: 'D1',
      },
    ],
    assumptions: [
      {
        id: 8,
        specification_id: SPEC_ID,
        content: 'Users have access to their email inbox',
        referenceCode: 'A1',
      },
    ],
  };
}

describe('buildGraphModel — descriptor projection onto node data', () => {
  it('projects each item reference code onto its node so the card needs no extra fetch', () => {
    const byId = nodesById(buildGraphModel(descriptorFixture()));

    expect(byId.get(nodeId('goal', 1))?.data.referenceCode).toBe('G1');
    expect(byId.get(nodeId('constraint', 4))?.data.referenceCode).toBe('CON1');
    expect(byId.get(nodeId('decision', 7))?.data.referenceCode).toBe('D1');
    expect(byId.get(nodeId('assumption', 8))?.data.referenceCode).toBe('A1');
  });

  it('projects each item content/name onto its node', () => {
    const byId = nodesById(buildGraphModel(descriptorFixture()));

    expect(byId.get(nodeId('goal', 1))?.data.content).toBe('Reduce signup drop-off');
    expect(byId.get(nodeId('constraint', 4))?.data.content).toBe('GDPR territory restrictions');
    expect(byId.get(nodeId('decision', 7))?.data.content).toBe('Magic-link authentication');
    expect(byId.get(nodeId('assumption', 8))?.data.content).toBe('Users have access to their email inbox');
  });

  it('projects each item rationale onto its node', () => {
    const byId = nodesById(buildGraphModel(descriptorFixture()));

    expect(byId.get(nodeId('goal', 1))?.data.rationale).toBe(
      'Telemetry shows 38% abandonment at password creation.',
    );
    expect(byId.get(nodeId('decision', 7))?.data.rationale).toBe(
      'Lower friction than passwords for returning users.',
    );
  });

  it('projects a missing rationale as an empty string rather than null/undefined', () => {
    const byId = nodesById(buildGraphModel(descriptorFixture()));

    // constraint(4) carries `rationale: null`; assumption(8) has no rationale field.
    expect(byId.get(nodeId('constraint', 4))?.data.rationale).toBe('');
    expect(byId.get(nodeId('assumption', 8))?.data.rationale).toBe('');
  });

  it('projects a missing reference code using the list-view fallback prefix plus id', () => {
    const fixture: EntitiesData = {
      ...emptySpec(),
      goals: [
        {
          id: 99,
          specification_id: SPEC_ID,
          kind: 'goal',
          subtype: null,
          content: 'Goal without a reference code',
          rationale: null,
          // referenceCode intentionally omitted (it is optional on the wire)
        },
      ],
    };

    const node = nodesById(buildGraphModel(fixture)).get(nodeId('goal', 99));

    expect(node?.data.referenceCode).toBe(createKnowledgeReferenceCode('goal', 99));
  });

  it('derives descriptor values from collections lacking a stored kind field', () => {
    // decision and assumption entities have no `kind` property of their own,
    // yet the projection must still carry their content, rationale and code.
    const byId = nodesById(buildGraphModel(descriptorFixture()));

    const decision = byId.get(nodeId('decision', 7));
    expect(decision?.data.kind).toBe('decision');
    expect(decision?.data.content).toBe('Magic-link authentication');
    expect(decision?.data.referenceCode).toBe('D1');

    const assumption = byId.get(nodeId('assumption', 8));
    expect(assumption?.data.kind).toBe('assumption');
    expect(assumption?.data.content).toBe('Users have access to their email inbox');
    expect(assumption?.data.referenceCode).toBe('A1');
  });

  it('carries the descriptor for every node in a populated shared fixture', () => {
    const entityState = crossPhaseDecisionLink();
    const model = buildGraphModel(entityState);

    // Build a lookup of source items keyed exactly like nodes are.
    const sourceById = new Map<string, { content: string; referenceCode: string; rationale: string }>();
    for (const goal of entityState.goals) {
      sourceById.set(nodeId('goal', goal.id), {
        content: goal.content,
        referenceCode: goal.referenceCode ?? createKnowledgeReferenceCode('goal', goal.id),
        rationale: goal.rationale ?? '',
      });
    }
    for (const constraint of entityState.constraints) {
      sourceById.set(nodeId('constraint', constraint.id), {
        content: constraint.content,
        referenceCode: constraint.referenceCode ?? createKnowledgeReferenceCode('constraint', constraint.id),
        rationale: constraint.rationale ?? '',
      });
    }
    for (const decision of entityState.decisions) {
      sourceById.set(nodeId('decision', decision.id), {
        content: decision.content,
        referenceCode: decision.referenceCode ?? createKnowledgeReferenceCode('decision', decision.id),
        rationale: decision.rationale ?? '',
      });
    }
    for (const requirement of entityState.requirements) {
      sourceById.set(nodeId('requirement', requirement.id), {
        content: requirement.content,
        referenceCode:
          requirement.referenceCode ?? createKnowledgeReferenceCode('requirement', requirement.id),
        rationale: requirement.rationale ?? '',
      });
    }

    expect(model.nodes.length).toBe(sourceById.size);
    for (const node of model.nodes) {
      const source = sourceById.get(node.id);
      expect(source, `node ${node.id} has a matching source item`).toBeDefined();
      expect(node.data.content).toBe(source?.content);
      expect(node.data.referenceCode).toBe(source?.referenceCode);
      expect(node.data.rationale).toBe(source?.rationale);
    }
  });
});
