import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildEconomicIntentGraphSnapshot,
  buildIntentContextSnapshot,
  renderIntentContextSnapshot,
} from './context-snapshot.js';
import {
  addKnowledgeRelationship,
  createDb,
  createKnowledgeItem,
  createSpecification,
  openReconciliationNeed,
  type DB,
} from './db.js';

let db: DB;
let specificationId: number;

function seedMixedDirectionGraph() {
  specificationId = createSpecification(db, 'Intent graph semantics').id;

  const goal = createKnowledgeItem(db, specificationId, 'goal', 'Reduce interview fatigue');
  const constraint = createKnowledgeItem(db, specificationId, 'constraint', 'Do not auto-close phases');
  const decision = createKnowledgeItem(db, specificationId, 'decision', 'Use turn-owned candidate sets', {
    rationale: 'Candidates keep user reaction explicit.',
  });
  const requirement = createKnowledgeItem(
    db,
    specificationId,
    'requirement',
    'Users can request acceleration',
  );
  const criterion = createKnowledgeItem(
    db,
    specificationId,
    'criterion',
    'Acceleration presents reviewed tradeoffs',
  );

  addKnowledgeRelationship(db, decision.id, goal.id, 'depends_on');
  addKnowledgeRelationship(db, constraint.id, decision.id, 'constrains');
  addKnowledgeRelationship(db, criterion.id, requirement.id, 'verifies');
  addKnowledgeRelationship(db, requirement.id, decision.id, 'derived_from');

  openReconciliationNeed(db, {
    specificationId,
    sourceItemId: decision.id,
    targetItemId: requirement.id,
    kind: 'needs_confirmation',
    reason: 'Acceleration requirement may need to follow the candidate-set decision.',
  });

  return { goal, constraint, decision, requirement, criterion };
}

describe('intent context snapshots', () => {
  beforeEach(() => {
    db = createDb();
  });

  it('builds item snapshots with reference metadata and relation-policy-rendered edge groups', () => {
    const { decision } = seedMixedDirectionGraph();

    const snapshot = buildIntentContextSnapshot(db, {
      specificationId,
      itemIds: [decision.id],
      neighborhood: 'immediate',
    });

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      id: decision.id,
      kind: 'decision',
      referenceCode: 'D1',
      content: 'Use turn-owned candidate sets',
      rationale: 'Candidates keep user reaction explicit.',
      relations: {
        dependencies: [
          {
            relation: 'depends_on',
            endpoint: 'source',
            label: 'depends on',
            otherItem: { kind: 'goal', referenceCode: 'G1', content: 'Reduce interview fatigue' },
          },
          {
            relation: 'constrains',
            endpoint: 'target',
            label: 'is constrained by',
            otherItem: { kind: 'constraint', referenceCode: 'CON1', content: 'Do not auto-close phases' },
          },
        ],
        dependents: [
          {
            relation: 'derived_from',
            endpoint: 'target',
            label: 'is source for',
            otherItem: { kind: 'requirement', referenceCode: 'R1' },
          },
        ],
      },
    });
  });

  it('projects distinct dependency and dependent neighborhoods from the same mixed-direction fixture', () => {
    const { decision } = seedMixedDirectionGraph();

    const dependencies = buildIntentContextSnapshot(db, {
      specificationId,
      itemIds: [decision.id],
      neighborhood: 'dependencies',
    });
    const dependents = buildIntentContextSnapshot(db, {
      specificationId,
      itemIds: [decision.id],
      neighborhood: 'dependents',
    });

    expect(dependencies.items[0]?.relations.dependencies.map((edge) => edge.otherItem.referenceCode)).toEqual(
      ['G1', 'CON1'],
    );
    expect(dependencies.items[0]?.relations.dependents).toEqual([]);

    expect(dependents.items[0]?.relations.dependencies).toEqual([]);
    expect(dependents.items[0]?.relations.dependents.map((edge) => edge.otherItem.referenceCode)).toEqual([
      'R1',
    ]);
  });

  it('includes evidence and reconciliation neighborhoods without requiring chat state', () => {
    const { requirement } = seedMixedDirectionGraph();

    const evidence = buildIntentContextSnapshot(db, {
      specificationId,
      itemIds: [requirement.id],
      neighborhood: 'evidence',
    });
    const reconciliation = buildIntentContextSnapshot(db, {
      specificationId,
      itemIds: [requirement.id],
      neighborhood: 'reconciliation',
    });

    expect(evidence.items[0]?.relations.evidence).toEqual([
      expect.objectContaining({
        relation: 'verifies',
        endpoint: 'target',
        label: 'is verified by',
        otherItem: expect.objectContaining({ referenceCode: 'AC1' }),
      }),
    ]);
    expect(reconciliation.items[0]?.reconciliationNeeds).toEqual([
      expect.objectContaining({
        kind: 'needs_confirmation',
        status: 'open',
        source: expect.objectContaining({ referenceCode: 'D1' }),
        target: expect.objectContaining({ referenceCode: 'R1' }),
      }),
    ]);
  });

  it('builds a compact economic whole-graph snapshot without item handles', () => {
    seedMixedDirectionGraph();

    const snapshot = buildEconomicIntentGraphSnapshot(db, { specificationId });

    expect(snapshot.scope).toBe('whole-graph');
    expect(snapshot.itemsByKind.decisions).toEqual([
      expect.objectContaining({ referenceCode: 'D1', content: 'Use turn-owned candidate sets' }),
    ]);
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: 'depends_on',
          source: expect.objectContaining({ referenceCode: 'D1' }),
        }),
        expect.objectContaining({
          relation: 'constrains',
          source: expect.objectContaining({ referenceCode: 'CON1' }),
        }),
        expect.objectContaining({
          relation: 'verifies',
          source: expect.objectContaining({ referenceCode: 'AC1' }),
        }),
        expect.objectContaining({
          relation: 'derived_from',
          source: expect.objectContaining({ referenceCode: 'R1' }),
        }),
      ]),
    );
    expect(snapshot).not.toHaveProperty('handles');
  });

  it('renders a selected reviewable golden snapshot', () => {
    const { decision } = seedMixedDirectionGraph();

    const snapshot = buildIntentContextSnapshot(db, {
      specificationId,
      itemIds: [decision.id],
      neighborhood: 'immediate',
    });

    expect(renderIntentContextSnapshot(snapshot)).toBe(`Intent context snapshot (immediate)

D1 decision: Use turn-owned candidate sets
Rationale: Candidates keep user reaction explicit.
Dependencies:
- depends on G1 goal: Reduce interview fatigue
- is constrained by CON1 constraint: Do not auto-close phases
Dependents:
- is source for R1 requirement: Users can request acceleration`);
  });
});
