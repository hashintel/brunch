import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { getElicitationGaps } from '../../graph/queries.js';
import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../graph/schema/nodes.js';
import {
  CAPABILITY_RELEVANT_GAPS,
  evaluateCapabilityReadiness,
  type CapabilityReadinessOutcome,
} from './capability-readiness.js';

function gap(
  overrides: Partial<ElicitationGap> & Pick<ElicitationGap, 'refersTo' | 'coverage'>,
): ElicitationGap {
  return {
    id: overrides.id ?? `${overrides.refersTo}:${overrides.question ?? 'gap'}`,
    specId: overrides.specId ?? 1,
    refersTo: overrides.refersTo,
    question: overrides.question ?? `${overrides.refersTo} question`,
    rationale: overrides.rationale ?? `${overrides.refersTo} rationale`,
    basis: overrides.basis ?? 'implicit',
    band: overrides.band ?? 'grounding',
    predicate: overrides.predicate ?? { kind: 'presence', minimum: 1, nodeKind: overrides.refersTo },
    importance: overrides.importance ?? 1,
    coverage: overrides.coverage,
    answered: overrides.answered ?? overrides.coverage >= 1,
    disposition: overrides.disposition ?? (overrides.coverage >= 1 ? 'answered' : 'open'),
    createdAtLsn: overrides.createdAtLsn ?? 1,
  };
}

function floorGaps(coverage: Partial<Record<NodeKind, number>> = {}): ElicitationGap[] {
  return ['context', 'thesis', 'goal', 'constraint'].map((kind) =>
    gap({ refersTo: kind as NodeKind, coverage: coverage[kind as NodeKind] ?? 1 }),
  );
}

function expectOutcomeStatus(
  outcome: CapabilityReadinessOutcome,
  status: CapabilityReadinessOutcome['status'],
): void {
  expect(outcome.status).toBe(status);
}

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('capability readiness over elicitation gaps', () => {
  it('enumerates relevant node kinds per requested capability', () => {
    expect(CAPABILITY_RELEVANT_GAPS).toEqual({
      'generative-lens': ['context', 'thesis', 'goal', 'constraint'],
      'propose-graph': ['context', 'thesis', 'goal', 'constraint'],
      'project-graph': ['context', 'thesis', 'goal', 'constraint'],
      'commitment-review': ['context', 'thesis', 'goal', 'constraint'],
    });
  });

  it('proceeds when all relevant gaps are covered', () => {
    const outcome = evaluateCapabilityReadiness('propose-graph', floorGaps());

    expect(outcome).toEqual({ status: 'proceed' });
  });

  it('negotiates with establishment-offer-shaped missing gaps when relevant grounding gaps are uncovered', () => {
    const outcome = evaluateCapabilityReadiness('project-graph', floorGaps({ thesis: 0, goal: 0 }));

    expect(outcome.status).toBe('negotiate');
    if (outcome.status !== 'negotiate') return;
    expect(outcome.offer.kind).toBe('establishment_offer');
    expect(outcome.offer.missingGaps.map((missing) => missing.refersTo)).toEqual(['thesis', 'goal']);
    expect(outcome.offer.missingGaps.map((missing) => missing.question)).toEqual([
      'thesis question',
      'goal question',
    ]);
    expect(outcome.offer.message).toContain('I can try, but');
  });

  it('proceeds at low epistemic status when relevant gaps have only partial coverage', () => {
    const outcome = evaluateCapabilityReadiness('generative-lens', floorGaps({ thesis: 0.5 }));

    expect(outcome).toEqual({ status: 'proceed_low_epistemic', coverage: 0.875 });
  });

  it('fails loud when a required kind has no referring gap record', () => {
    expect(() => evaluateCapabilityReadiness('propose-graph', floorGaps().slice(0, 3))).toThrow(
      /no elicitation gap for constraint/,
    );
  });

  it('moves from negotiate to proceed when live presence coverage fills the grounding floor', () => {
    const db = createTestDb();
    const executor = new CommandExecutor(db);
    const created = executor.createSpec({ name: 'Readiness Spec', slug: 'readiness-spec' });
    expect(created.status).toBe('success');
    if (created.status !== 'success') throw new Error('unreachable');

    expectOutcomeStatus(
      evaluateCapabilityReadiness('propose-graph', getElicitationGaps(db, created.specId)),
      'negotiate',
    );

    for (const [kind, title, detail] of [
      ['context', 'Local product spec workspace', undefined],
      ['thesis', 'For builders who need agent-aided specification', undefined],
      ['goal', 'Help a builder co-author a graph-native spec', undefined],
      ['constraint', 'Runs locally over the Pi harness', undefined],
      ['term', 'Spec workspace', { definition: 'A local graph-backed specification authoring space' }],
      ['assumption', 'Current planning is too prose-heavy', undefined],
    ] as const) {
      const result = executor.createNode({ specId: created.specId, plane: 'intent', kind, title, detail });
      expect(result.status).toBe('success');
    }

    expectOutcomeStatus(
      evaluateCapabilityReadiness('propose-graph', getElicitationGaps(db, created.specId)),
      'proceed',
    );
  });

  it('proves same-kind gaps resolve independently through their own question and satisfier', () => {
    const outcome = evaluateCapabilityReadiness('propose-graph', [
      ...floorGaps(),
      gap({
        id: 'thesis:stakeholder',
        refersTo: 'thesis',
        question: 'Who is the primary user?',
        coverage: 1,
      }),
      gap({
        id: 'thesis:pain',
        refersTo: 'thesis',
        question: 'Why is this painful enough to solve now?',
        coverage: 0,
      }),
    ]);

    expect(outcome.status).toBe('negotiate');
    if (outcome.status !== 'negotiate') return;
    expect(outcome.offer.missingGaps).toEqual([
      expect.objectContaining({
        id: 'thesis:pain',
        refersTo: 'thesis',
        question: 'Why is this painful enough to solve now?',
      }),
    ]);
  });

  it('never returns a refusal outcome and does not import grade-gate symbols', () => {
    const outcomes = [
      evaluateCapabilityReadiness('propose-graph', floorGaps({ context: 0 })),
      evaluateCapabilityReadiness('propose-graph', floorGaps({ context: 0.25 })),
      evaluateCapabilityReadiness('propose-graph', floorGaps()),
    ];

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'negotiate',
      'proceed_low_epistemic',
      'proceed',
    ]);
    expect(outcomes.map((outcome) => outcome.status)).not.toContain('refuse');

    const sourcePath = fileURLToPath(new URL('./capability-readiness.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE/);
  });
});
