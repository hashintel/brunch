import { describe, expect, it } from 'vitest';

import {
  activePathDivergence,
  crossPhaseDecisionLink,
  denseGoalAnchor,
  emptySpec,
  singleItemNoEdges,
} from '@/client/__fixtures__/graph-view.js';
import { buildGraphModel } from '@/client/components/graph/buildGraphModel.js';
import type { GraphEdgeRelationship, GraphNodeKind } from '@/client/components/graph/types.js';
import type { EntitiesData } from '@/shared/api-types.js';

const SPEC_ID = 1;

/**
 * The list view's canonical projection keys every knowledge item by
 * `${kind}:${id}` (see -structured-list-view.tsx#projectGraph). The graph
 * model mirrors that view, so a node's identity is derived the same way and a
 * relationship endpoint maps to its node by the same rule.
 */
function nodeId(kind: GraphNodeKind, id: number): string {
  return `${kind}:${id}`;
}

function nodesById(model: ReturnType<typeof buildGraphModel>) {
  return new Map(model.nodes.map((node) => [node.id, node]));
}

/** Total knowledge items the list view would render across all eight kinds. */
function totalItems(entityState: EntitiesData): number {
  return (
    entityState.goals.length +
    entityState.terms.length +
    entityState.contexts.length +
    entityState.constraints.length +
    entityState.requirements.length +
    entityState.criteria.length +
    entityState.decisions.length +
    entityState.assumptions.length
  );
}

/**
 * One item per knowledge kind plus exactly one relationship per relationship
 * type, with a deliberate hub (the requirement) so degree counting is
 * unambiguous:
 *   - depends_on:   requirement(5) -> goal(1)
 *   - derived_from: requirement(5) -> decision(7)
 *   - constrains:   constraint(4)  -> requirement(5)
 *   - verifies:     criterion(6)   -> requirement(5)
 *   - refines:      decision(7)    -> goal(1)
 */
function allKindsAndRelations(): EntitiesData {
  return {
    goals: [
      {
        id: 1,
        specification_id: SPEC_ID,
        kind: 'goal',
        subtype: null,
        content: 'A goal',
        rationale: null,
        referenceCode: 'G1',
      },
    ],
    terms: [
      {
        id: 2,
        specification_id: SPEC_ID,
        kind: 'term',
        subtype: null,
        content: 'A term',
        rationale: null,
        referenceCode: 'T1',
      },
    ],
    contexts: [
      {
        id: 3,
        specification_id: SPEC_ID,
        kind: 'context',
        subtype: null,
        content: 'A context',
        rationale: null,
        referenceCode: 'CTX1',
      },
    ],
    constraints: [
      {
        id: 4,
        specification_id: SPEC_ID,
        kind: 'constraint',
        subtype: null,
        content: 'A constraint',
        rationale: null,
        referenceCode: 'CON1',
      },
    ],
    requirements: [
      {
        id: 5,
        specification_id: SPEC_ID,
        kind: 'requirement',
        subtype: null,
        content: 'A requirement',
        rationale: null,
        referenceCode: 'R1',
      },
    ],
    criteria: [
      {
        id: 6,
        specification_id: SPEC_ID,
        kind: 'criterion',
        subtype: null,
        content: 'A criterion',
        rationale: null,
        referenceCode: 'AC1',
      },
    ],
    decisions: [
      {
        id: 7,
        specification_id: SPEC_ID,
        content: 'A decision',
        rationale: null,
        referenceCode: 'D1',
      },
    ],
    assumptions: [
      {
        id: 8,
        specification_id: SPEC_ID,
        content: 'An assumption',
        referenceCode: 'A1',
      },
    ],
    relationships: [
      {
        type: 'depends_on',
        source: { kind: 'requirement', collection: 'knowledge_item', id: 5 },
        target: { kind: 'goal', collection: 'knowledge_item', id: 1 },
      },
      {
        type: 'derived_from',
        source: { kind: 'requirement', collection: 'knowledge_item', id: 5 },
        target: { kind: 'decision', collection: 'knowledge_item', id: 7 },
      },
      {
        type: 'constrains',
        source: { kind: 'constraint', collection: 'knowledge_item', id: 4 },
        target: { kind: 'requirement', collection: 'knowledge_item', id: 5 },
      },
      {
        type: 'verifies',
        source: { kind: 'criterion', collection: 'knowledge_item', id: 6 },
        target: { kind: 'requirement', collection: 'knowledge_item', id: 5 },
      },
      {
        type: 'refines',
        source: { kind: 'decision', collection: 'knowledge_item', id: 7 },
        target: { kind: 'goal', collection: 'knowledge_item', id: 1 },
      },
    ],
  };
}

const allKinds: GraphNodeKind[] = [
  'goal',
  'term',
  'context',
  'constraint',
  'requirement',
  'criterion',
  'decision',
  'assumption',
];

const allRelations: GraphEdgeRelationship[] = [
  'depends_on',
  'derived_from',
  'constrains',
  'verifies',
  'refines',
];

describe('buildGraphModel', () => {
  it('produces exactly one node per item across all eight knowledge kinds', () => {
    const model = buildGraphModel(allKindsAndRelations());

    expect(model.nodes).toHaveLength(8);
    const kinds = model.nodes.map((node) => node.data.kind).sort();
    expect(kinds).toEqual([...allKinds].sort());
  });

  it('derives a node kind from its collection even when the stored item carries no kind field', () => {
    const model = buildGraphModel(allKindsAndRelations());
    const byId = nodesById(model);

    // decision and assumption entities have no `kind` property of their own;
    // the node kind must come from the collection they live in.
    expect(byId.get(nodeId('decision', 7))?.data.kind).toBe('decision');
    expect(byId.get(nodeId('assumption', 8))?.data.kind).toBe('assumption');
  });

  it('produces exactly one edge per relationship across all five relationship types', () => {
    const model = buildGraphModel(allKindsAndRelations());

    expect(model.edges).toHaveLength(5);
    const relationships = model.edges.map((edge) => edge.data.relationship).sort();
    expect(relationships).toEqual([...allRelations].sort());
  });

  it('wires each edge between the source and target nodes of its relationship', () => {
    const model = buildGraphModel(allKindsAndRelations());
    const byId = nodesById(model);

    for (const rel of allKindsAndRelations().relationships) {
      const source = nodeId(rel.source.kind, rel.source.id);
      const target = nodeId(rel.target.kind, rel.target.id);

      // both endpoints resolve to real nodes
      expect(byId.has(source)).toBe(true);
      expect(byId.has(target)).toBe(true);

      const edge = model.edges.find(
        (candidate) =>
          candidate.source === source &&
          candidate.target === target &&
          candidate.data.relationship === rel.type,
      );
      expect(edge, `edge ${rel.type} ${source}->${target}`).toBeDefined();
    }
  });

  it('omits relationships whose source or target item is missing', () => {
    const fixture = allKindsAndRelations();
    fixture.relationships = [
      {
        type: 'depends_on',
        source: { kind: 'requirement', collection: 'knowledge_item', id: 5 },
        target: { kind: 'goal', collection: 'knowledge_item', id: 1 },
      },
      {
        type: 'depends_on',
        source: { kind: 'requirement', collection: 'knowledge_item', id: 5 },
        target: { kind: 'goal', collection: 'knowledge_item', id: 999 },
      },
      {
        type: 'refines',
        source: { kind: 'decision', collection: 'knowledge_item', id: 999 },
        target: { kind: 'goal', collection: 'knowledge_item', id: 1 },
      },
    ];

    const model = buildGraphModel(fixture);

    expect(model.edges).toEqual([
      {
        source: nodeId('requirement', 5),
        target: nodeId('goal', 1),
        data: { relationship: 'depends_on' },
      },
    ]);
    expect(nodesById(model).get(nodeId('requirement', 5))?.data.degree).toBe(1);
    expect(nodesById(model).get(nodeId('goal', 1))?.data.degree).toBe(1);
  });

  it('computes each node degree as the count of incident edges (incoming and outgoing)', () => {
    const model = buildGraphModel(allKindsAndRelations());
    const byId = nodesById(model);

    // requirement(5) is touched by depends_on, derived_from, constrains, verifies
    expect(byId.get(nodeId('requirement', 5))?.data.degree).toBe(4);
    // goal(1) is touched by depends_on and refines
    expect(byId.get(nodeId('goal', 1))?.data.degree).toBe(2);
    // decision(7) is touched by derived_from and refines
    expect(byId.get(nodeId('decision', 7))?.data.degree).toBe(2);
    // constraint(4) and criterion(6) each touched by one edge
    expect(byId.get(nodeId('constraint', 4))?.data.degree).toBe(1);
    expect(byId.get(nodeId('criterion', 6))?.data.degree).toBe(1);
    // term(2), context(3), assumption(8) are isolated
    expect(byId.get(nodeId('term', 2))?.data.degree).toBe(0);
    expect(byId.get(nodeId('context', 3))?.data.degree).toBe(0);
    expect(byId.get(nodeId('assumption', 8))?.data.degree).toBe(0);
  });

  it('counts a high-degree hub by summing all of its incident edges', () => {
    // denseGoalAnchor: 15 decisions each refine the single goal.
    const model = buildGraphModel(denseGoalAnchor());
    const byId = nodesById(model);

    expect(model.nodes).toHaveLength(16);
    expect(model.edges).toHaveLength(15);
    expect(byId.get(nodeId('goal', 100))?.data.degree).toBe(15);
    for (let index = 0; index < 15; index += 1) {
      expect(byId.get(nodeId('decision', 200 + index))?.data.degree).toBe(1);
    }
  });

  it('returns an empty model for a specification with no items', () => {
    const model = buildGraphModel(emptySpec());

    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
  });

  it('represents an item with no relationships as an isolated node of degree zero', () => {
    const model = buildGraphModel(singleItemNoEdges());

    expect(model.nodes).toHaveLength(1);
    expect(model.edges).toEqual([]);
    expect(model.nodes[0]?.data.kind).toBe('goal');
    expect(model.nodes[0]?.data.degree).toBe(0);
  });

  it('mirrors the list view: node count equals the total rendered item count', () => {
    const entityState = crossPhaseDecisionLink();
    const model = buildGraphModel(entityState);

    expect(model.nodes).toHaveLength(totalItems(entityState));
    expect(model.edges).toHaveLength(entityState.relationships.length);
  });

  it('defaults selected and dimmed to false in the pure model', () => {
    const model = buildGraphModel(activePathDivergence());

    expect(model.nodes.length).toBeGreaterThan(0);
    for (const node of model.nodes) {
      expect(node.data.selected).toBe(false);
      expect(node.data.dimmed).toBe(false);
    }
  });
});
