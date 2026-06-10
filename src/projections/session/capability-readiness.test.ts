import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { getElicitationGaps } from '../../graph/queries.js';
import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import {
  CAPABILITY_RELEVANT_GAPS,
  evaluateCapabilityReadiness,
  type CapabilityReadinessOutcome,
} from './capability-readiness.js';

function gap(overrides: Partial<ElicitationGap> & Pick<ElicitationGap, 'name' | 'coverage'>): ElicitationGap {
  return {
    id: overrides.id ?? overrides.name,
    specId: overrides.specId ?? 1,
    name: overrides.name,
    rationale: overrides.rationale ?? `${overrides.name} rationale`,
    basis: overrides.basis ?? 'implicit',
    band: overrides.band ?? 'grounding',
    predicate: overrides.predicate ?? { kind: 'presence', minimum: 1, band: 'grounding' },
    importance: overrides.importance ?? 1,
    coverage: overrides.coverage,
    answered: overrides.answered ?? overrides.coverage >= 1,
    disposition: overrides.disposition ?? (overrides.coverage >= 1 ? 'answered' : 'open'),
    createdAtLsn: overrides.createdAtLsn ?? 1,
  };
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
  it('enumerates relevant gap typologies per requested capability', () => {
    expect(CAPABILITY_RELEVANT_GAPS).toEqual({
      'generative-lens': ['domain', 'protagonist', 'pain_pull', 'constraint'],
      'propose-graph': ['domain', 'protagonist', 'pain_pull', 'constraint'],
      'project-graph': ['domain', 'protagonist', 'pain_pull', 'constraint'],
      'commitment-review': ['domain', 'protagonist', 'pain_pull', 'constraint'],
    });
  });

  it('proceeds when all relevant gaps are covered', () => {
    const outcome = evaluateCapabilityReadiness('propose-graph', [
      gap({ name: 'domain', coverage: 1 }),
      gap({ name: 'protagonist', coverage: 1 }),
      gap({ name: 'pain_pull', coverage: 1 }),
      gap({ name: 'constraint', coverage: 1 }),
    ]);

    expect(outcome).toEqual({ status: 'proceed' });
  });

  it('negotiates with establishment-offer-shaped missing gaps when relevant grounding gaps are uncovered', () => {
    const outcome = evaluateCapabilityReadiness('project-graph', [
      gap({ name: 'domain', coverage: 1 }),
      gap({ name: 'protagonist', coverage: 0 }),
      gap({ name: 'pain_pull', coverage: 0 }),
      gap({ name: 'constraint', coverage: 1 }),
    ]);

    expect(outcome.status).toBe('negotiate');
    if (outcome.status !== 'negotiate') return;
    expect(outcome.offer.kind).toBe('establishment_offer');
    expect(outcome.offer.missingGaps.map((missing) => missing.name)).toEqual(['protagonist', 'pain_pull']);
    expect(outcome.offer.message).toContain('I can try, but');
  });

  it('proceeds at low epistemic status when relevant gaps have only partial coverage', () => {
    const outcome = evaluateCapabilityReadiness('generative-lens', [
      gap({ name: 'domain', coverage: 1 }),
      gap({ name: 'protagonist', coverage: 0.5 }),
      gap({ name: 'pain_pull', coverage: 1 }),
      gap({ name: 'constraint', coverage: 1 }),
    ]);

    expect(outcome).toEqual({ status: 'proceed_low_epistemic', coverage: 0.875 });
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

    for (const [kind, title] of [
      ['context', 'Local product spec workspace'],
      ['goal', 'Help a builder co-author a graph-native spec'],
      ['assumption', 'Current planning is too prose-heavy'],
      ['constraint', 'Runs locally over the Pi harness'],
    ] as const) {
      const result = executor.createNode({ specId: created.specId, plane: 'intent', kind, title });
      expect(result.status).toBe('success');
    }

    expectOutcomeStatus(
      evaluateCapabilityReadiness('propose-graph', getElicitationGaps(db, created.specId)),
      'proceed',
    );
  });

  it('never returns a refusal outcome and does not import grade-gate symbols', () => {
    const outcomes = [
      evaluateCapabilityReadiness('propose-graph', []),
      evaluateCapabilityReadiness('propose-graph', [
        gap({ name: 'domain', coverage: 0.25 }),
        gap({ name: 'protagonist', coverage: 1 }),
        gap({ name: 'pain_pull', coverage: 1 }),
        gap({ name: 'constraint', coverage: 1 }),
      ]),
      evaluateCapabilityReadiness('propose-graph', [
        gap({ name: 'domain', coverage: 1 }),
        gap({ name: 'protagonist', coverage: 1 }),
        gap({ name: 'pain_pull', coverage: 1 }),
        gap({ name: 'constraint', coverage: 1 }),
      ]),
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
