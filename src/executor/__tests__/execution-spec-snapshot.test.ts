import { describe, expect, it } from 'vitest';

import type { GraphEdge } from '../../graph/schema/edges.js';
import type { GraphNode, NodeKind, NodePlane } from '../../graph/schema/nodes.js';
import { projectExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const base = {
  specId: 7,
  basis: 'explicit',
  settlement: 'settled',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

function node(args: {
  id: number;
  plane: NodePlane;
  kind: NodeKind;
  kindOrdinal: number;
  title: string;
  body?: string;
}): GraphNode {
  return { ...base, ...args };
}

function edge(args: {
  id: number;
  category: GraphEdge['category'];
  sourceId: number;
  targetId: number;
  stance?: GraphEdge['stance'];
}): GraphEdge {
  const { stance, ...rest } = args;
  return stance ? { ...base, ...rest, stance } : { ...base, ...rest };
}

describe('projectExecutionSpecSnapshot', () => {
  it('projects requirements, criteria verifies links, mode, and execution context', () => {
    const requirementA = node({
      id: 10,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 2,
      title: 'Render graph canvas',
      body: 'Users can switch from list view to a spatial canvas.',
    });
    const requirementB = node({
      id: 11,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Persist layout choice',
    });
    const criterion = node({
      id: 20,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Canvas appears after toggle',
      body: 'A browser-level check proves the canvas is reachable after toggling.',
    });
    const antiCriterion = node({
      id: 21,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 2,
      title: 'Rejected witness',
    });
    const constraint = node({
      id: 30,
      plane: 'intent',
      kind: 'constraint',
      kindOrdinal: 1,
      title: 'Do not replace list view',
    });
    const decision = node({
      id: 31,
      plane: 'intent',
      kind: 'decision',
      kindOrdinal: 1,
      title: 'Use React Flow',
    });
    const sketch = node({
      id: 40,
      plane: 'design',
      kind: 'sketch',
      kindOrdinal: 1,
      title: 'Route-level canvas shell',
    });
    const check = node({
      id: 50,
      plane: 'oracle',
      kind: 'check',
      kindOrdinal: 1,
      title: 'Playwright viewport check',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'brownfield',
      nodes: [requirementA, criterion, check, requirementB, antiCriterion, sketch, decision, constraint],
      edges: [
        edge({
          id: 1,
          category: 'witness',
          sourceId: criterion.id,
          targetId: requirementA.id,
          stance: 'for',
        }),
        edge({
          id: 2,
          category: 'witness',
          sourceId: criterion.id,
          targetId: requirementB.id,
          stance: 'for',
        }),
        edge({
          id: 3,
          category: 'witness',
          sourceId: antiCriterion.id,
          targetId: requirementA.id,
          stance: 'against',
        }),
        edge({
          id: 4,
          category: 'rationale',
          sourceId: criterion.id,
          targetId: requirementA.id,
          stance: 'for',
        }),
        edge({
          id: 5,
          category: 'dependency',
          sourceId: requirementB.id,
          targetId: requirementA.id,
        }),
      ],
    });

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.specId).toBe('7');
    expect(snapshot.mode).toBe('brownfield');
    expect(snapshot.requirements.map((item) => item.itemId)).toEqual(['REQ1', 'REQ2']);
    expect(snapshot.requirements[0]).toMatchObject({
      title: 'Persist layout choice',
      content: 'Persist layout choice',
      dependsOn: [],
    });
    expect(snapshot.requirements[1]).toMatchObject({
      itemId: 'REQ2',
      title: 'Render graph canvas',
      dependsOn: ['REQ1'],
    });
    expect(snapshot.criteria).toEqual([
      expect.objectContaining({
        itemId: 'AC1',
        content: 'A browser-level check proves the canvas is reachable after toggling.',
        verifiesRequirements: ['REQ1', 'REQ2'],
        verifiesFrontiers: [],
      }),
      expect.objectContaining({ itemId: 'AC2', verifiesRequirements: [], verifiesFrontiers: [] }),
    ]);
    expect(snapshot.context.constraints.map((item) => item.itemId)).toEqual(['CON1']);
    expect(snapshot.context.decisions.map((item) => item.itemId)).toEqual(['D1']);
    expect(snapshot.context.design.map((item) => item.itemId)).toEqual(['SKT1']);
    expect(snapshot.context.oracle.map((item) => item.itemId)).toEqual(['CH1']);
  });

  it('ignores dependency edges that are not executable requirement dependencies', () => {
    const requirement = node({
      id: 10,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Build feature',
    });
    const decision = node({
      id: 20,
      plane: 'intent',
      kind: 'decision',
      kindOrdinal: 1,
      title: 'Choose architecture',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'greenfield',
      nodes: [requirement, decision],
      edges: [edge({ id: 1, category: 'dependency', sourceId: decision.id, targetId: requirement.id })],
    });

    expect(snapshot.requirements[0]?.dependsOn).toEqual([]);
    expect(snapshot).not.toHaveProperty('unprojectedDependencies');
  });

  it('projects committed scope packages into executor-facing scope snapshots', () => {
    const frontier = node({
      id: 1,
      plane: 'plan',
      kind: 'frontier',
      kindOrdinal: 1,
      title: 'Execution handoff',
    });
    const scope = node({
      id: 2,
      plane: 'plan',
      kind: 'scope',
      kindOrdinal: 1,
      title: 'Canvas scope',
      body: 'Build the graph canvas from committed design and verification anchors.',
    });
    const requirement = node({
      id: 3,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Render graph canvas',
    });
    const criterion = node({
      id: 4,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Canvas becomes visible',
      body: 'A visible canvas proves the view is reachable.',
    });
    const design = node({
      id: 5,
      plane: 'design',
      kind: 'module',
      kindOrdinal: 1,
      title: 'Canvas route module',
    });
    const verification = node({
      id: 6,
      plane: 'oracle',
      kind: 'check',
      kindOrdinal: 1,
      title: 'Canvas smoke test',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'brownfield',
      nodes: [frontier, scope, requirement, criterion, design, verification],
      edges: [
        edge({ id: 1, category: 'composition', sourceId: frontier.id, targetId: scope.id }),
        edge({ id: 2, category: 'realization', sourceId: requirement.id, targetId: scope.id }),
        edge({ id: 3, category: 'dependency', sourceId: criterion.id, targetId: scope.id }),
        edge({ id: 4, category: 'composition', sourceId: scope.id, targetId: design.id }),
        edge({ id: 5, category: 'dependency', sourceId: verification.id, targetId: scope.id }),
        edge({ id: 6, category: 'witness', sourceId: criterion.id, targetId: requirement.id, stance: 'for' }),
      ],
    });

    expect(snapshot.scopes).toEqual([
      {
        itemId: 'SCP1',
        nodeId: 2,
        title: 'Canvas scope',
        content: 'Build the graph canvas from committed design and verification anchors.',
        dependsOn: [],
        frontierIds: ['F1'],
        requirementIds: ['REQ1'],
        criteria: [
          expect.objectContaining({
            itemId: 'AC1',
            content: 'A visible canvas proves the view is reachable.',
          }),
        ],
        design: [expect.objectContaining({ itemId: 'MOD1', title: 'Canvas route module' })],
        verification: [expect.objectContaining({ itemId: 'CH1', title: 'Canvas smoke test' })],
      },
    ]);
  });

  it('does not accept non-canonical scope anchor directions', () => {
    const frontier = node({
      id: 1,
      plane: 'plan',
      kind: 'frontier',
      kindOrdinal: 1,
      title: 'Execution handoff',
    });
    const scope = node({
      id: 2,
      plane: 'plan',
      kind: 'scope',
      kindOrdinal: 1,
      title: 'Canvas scope',
    });
    const requirement = node({
      id: 3,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Render graph canvas',
    });
    const criterion = node({
      id: 4,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Canvas becomes visible',
    });
    const verification = node({
      id: 5,
      plane: 'oracle',
      kind: 'check',
      kindOrdinal: 1,
      title: 'Canvas smoke test',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'brownfield',
      nodes: [frontier, scope, requirement, criterion, verification],
      edges: [
        edge({ id: 1, category: 'composition', sourceId: frontier.id, targetId: scope.id }),
        edge({ id: 2, category: 'realization', sourceId: scope.id, targetId: requirement.id }),
        edge({ id: 3, category: 'realization', sourceId: scope.id, targetId: criterion.id }),
        edge({ id: 4, category: 'witness', sourceId: verification.id, targetId: scope.id, stance: 'for' }),
      ],
    });

    expect(snapshot.scopes[0]).toMatchObject({ requirementIds: [], criteria: [], verification: [] });
  });

  it('requires criteria to be attached directly to the scope package', () => {
    const frontier = node({
      id: 1,
      plane: 'plan',
      kind: 'frontier',
      kindOrdinal: 1,
      title: 'Execution handoff',
    });
    const scope = node({
      id: 2,
      plane: 'plan',
      kind: 'scope',
      kindOrdinal: 1,
      title: 'Canvas scope',
    });
    const requirement = node({
      id: 3,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Render graph canvas',
    });
    const criterion = node({
      id: 4,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Canvas becomes visible',
      body: 'A visible canvas proves the view is reachable.',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'brownfield',
      nodes: [frontier, scope, requirement, criterion],
      edges: [
        edge({ id: 1, category: 'composition', sourceId: frontier.id, targetId: scope.id }),
        edge({ id: 2, category: 'realization', sourceId: requirement.id, targetId: scope.id }),
        edge({ id: 3, category: 'witness', sourceId: criterion.id, targetId: requirement.id, stance: 'for' }),
      ],
    });

    expect(snapshot.scopes[0]?.criteria).toEqual([]);
  });

  it('excludes advisory nodes and edges from executable truth', () => {
    const requirement = node({
      id: 1,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Settled requirement',
    });
    const advisoryScope = {
      ...node({ id: 2, plane: 'plan', kind: 'scope', kindOrdinal: 1, title: 'Advisory scope' }),
      settlement: 'advisory' as const,
    };

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'greenfield',
      nodes: [requirement, advisoryScope],
      edges: [],
    });

    expect(snapshot.requirements.map((item) => item.itemId)).toEqual(['REQ1']);
    expect(snapshot.scopes).toEqual([]);
  });

  it('marks criteria linked directly to the scope so fan-out can preserve them', () => {
    const frontier = node({
      id: 1,
      plane: 'plan',
      kind: 'frontier',
      kindOrdinal: 1,
      title: 'Execution handoff',
    });
    const scope = node({
      id: 2,
      plane: 'plan',
      kind: 'scope',
      kindOrdinal: 1,
      title: 'Canvas scope',
    });
    const requirementA = node({
      id: 3,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Render graph canvas',
    });
    const requirementB = node({
      id: 4,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 2,
      title: 'Wire keyboard shortcut',
    });
    const sharedCriterion = node({
      id: 5,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Flow is coherent',
    });
    const requirementCriterion = node({
      id: 6,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 2,
      title: 'Canvas becomes visible',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'brownfield',
      nodes: [frontier, scope, requirementA, requirementB, sharedCriterion, requirementCriterion],
      edges: [
        edge({ id: 1, category: 'composition', sourceId: frontier.id, targetId: scope.id }),
        edge({ id: 2, category: 'realization', sourceId: requirementA.id, targetId: scope.id }),
        edge({ id: 3, category: 'realization', sourceId: requirementB.id, targetId: scope.id }),
        edge({ id: 4, category: 'dependency', sourceId: sharedCriterion.id, targetId: scope.id }),
        edge({
          id: 5,
          category: 'witness',
          sourceId: requirementCriterion.id,
          targetId: requirementA.id,
          stance: 'for',
        }),
      ],
    });

    expect(snapshot.scopes[0]?.criteria).toEqual([
      expect.objectContaining({ itemId: 'AC1', scopeLinked: true, verifies: [] }),
    ]);
  });
});
