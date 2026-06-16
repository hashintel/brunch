import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { CommandExecutor } from '../command-executor.js';
import { selectElicitationGap, sortElicitationGapsForAsking } from '../elicitation-driver.js';
import { getElicitationGaps } from '../queries.js';
import type { ElicitationGap } from '../schema/elicitation-gaps.js';
import type { NodeKind, ReadinessBand } from '../schema/nodes.js';

function gap(overrides: Partial<ElicitationGap> & Pick<ElicitationGap, 'id'>): ElicitationGap {
  const refersTo = overrides.refersTo ?? 'context';
  const coverage = overrides.coverage ?? 0;
  return {
    specId: 1,
    refersTo,
    question: `${refersTo} question`,
    rationale: `${refersTo} rationale`,
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', minimum: 1, nodeKind: refersTo },
    importance: 1,
    coverage,
    answered: coverage >= 1,
    disposition: coverage >= 1 ? 'answered' : 'open',
    createdAtLsn: 1,
    ...overrides,
  };
}

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('elicitation driver rank/select', () => {
  it('sorts open gaps by band, importance, coverage, affinity, then stable id', () => {
    const tiedLate = gap({ id: '9', refersTo: 'term', coverage: 0.1, createdAtLsn: 9 });
    const tiedEarlyById = gap({ id: '2', refersTo: 'term', coverage: 0.1, createdAtLsn: 2 });
    const tiedEarliestById = gap({ id: '1', refersTo: 'term', coverage: 0.1, createdAtLsn: 2 });
    const affinity = gap({ id: 'affinity', refersTo: 'module', coverage: 0.1, planeAffinity: 'design' });
    const lowerCoverage = gap({ id: 'low-coverage', refersTo: 'constraint', coverage: 0 });
    const higherImportance = gap({ id: 'important', refersTo: 'goal', importance: 4, coverage: 0.9 });
    const laterBand = gap({
      id: 'elicitation-band',
      refersTo: 'requirement',
      band: 'elicitation',
      importance: 100,
      coverage: 0,
    });

    expect(
      sortElicitationGapsForAsking(
        [laterBand, tiedLate, affinity, higherImportance, tiedEarlyById, tiedEarliestById, lowerCoverage],
        { agentLens: 'design' },
      ).map((entry) => entry.id),
    ).toEqual(['important', 'low-coverage', 'affinity', '1', '2', '9', 'elicitation-band']);
  });

  it('selects only unanswered open or reopened gaps', () => {
    expect(
      selectElicitationGap([
        gap({ id: 'answered', disposition: 'answered', answered: true, coverage: 1 }),
        gap({ id: 'not-applicable', disposition: 'not_applicable' }),
        gap({ id: 'irrelevant', disposition: 'irrelevant' }),
        gap({ id: 'reopened', disposition: 'reopened', refersTo: 'goal' }),
      ])?.id,
    ).toBe('reopened');

    expect(
      selectElicitationGap([gap({ id: 'done', disposition: 'answered', answered: true, coverage: 1 })]),
    ).toBe(undefined);
  });

  it('selects from the requested spec gaps read through the graph boundary', () => {
    const db = createTestDb();
    const executor = new CommandExecutor(db);
    const specA = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
    const specB = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
    expect(specA.status).toBe('success');
    expect(specB.status).toBe('success');
    if (specA.status !== 'success' || specB.status !== 'success') throw new Error('unreachable');

    const highPriorityOtherSpec = executor.createElicitationGap({
      specId: specB.specId,
      refersTo: 'criterion',
      question: 'Other spec should never be recommended here',
      rationale: 'Sibling-spec isolation guard',
      band: 'grounding',
      predicate: { kind: 'manual', rubric: 'manual check' },
      importance: 100,
    });
    expect(highPriorityOtherSpec.status).toBe('success');

    const selected = selectElicitationGap(getElicitationGaps(db, specA.specId));

    expect(selected?.question).not.toBe('Other spec should never be recommended here');
    expect(selected?.specId).toBe(specA.specId);
  });
});

it('uses the readiness band declaration order as the band precedence', () => {
  const sorted = sortElicitationGapsForAsking([
    gap({ id: 'commitment', band: 'commitment' as ReadinessBand, refersTo: 'criterion' as NodeKind }),
    gap({ id: 'grounding', band: 'grounding' as ReadinessBand, refersTo: 'context' as NodeKind }),
    gap({ id: 'elicitation', band: 'elicitation' as ReadinessBand, refersTo: 'requirement' as NodeKind }),
  ]);

  expect(sorted.map((entry) => entry.id)).toEqual(['grounding', 'elicitation', 'commitment']);
});
