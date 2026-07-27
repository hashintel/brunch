import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluatePlanShape } from './plan-eval.js';
import { loadPlan } from './plan-loader.js';
import type { Plan } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', '..', 'fixtures');

const REFERENCE_FIXTURES = ['parallel-utils', 'layered-todo', 'resilient-pipeline'] as const;

function loadFixture(name: string): Plan {
  return loadPlan(join(fixturesDir, name, 'plan.yaml'));
}

// Structural editing helpers — mutate a loaded fixture to manufacture a
// strictly-worse plan without rewriting the whole structure.
function clone(plan: Plan): Plan {
  return structuredClone(plan);
}

describe('evaluatePlanShape — self-test (reference fixtures are the target shape)', () => {
  it.each(REFERENCE_FIXTURES)('accepts and maximally scores %s', (name) => {
    const report = evaluatePlanShape(loadFixture(name));
    expect(report.verdict).toBe('accept');
    expect(report.hardFailures).toEqual([]);
    expect(report.overall).toBe(1);
  });

  it.each(REFERENCE_FIXTURES)('reports no structural evidence against %s', (name) => {
    const report = evaluatePlanShape(loadFixture(name));
    expect(report.evidence.conflictingPaths).toEqual([]);
    expect(report.evidence.redundantEdges).toEqual([]);
    expect(report.evidence.slicesMissingWrites).toEqual([]);
    expect(report.evidence.multiSliceEpicsMissingSeam).toEqual([]);
  });
});

describe('evaluatePlanShape — hard gate', () => {
  it('rejects a plan with a write conflict (two slices, same file)', () => {
    const plan = clone(loadFixture('parallel-utils'));
    // chunk and unique both claim src/chunk.ts.
    const unique = plan.slices.find((s) => s.id === 'unique')!;
    unique.writes = ['src/chunk.ts'];

    const report = evaluatePlanShape(plan);
    expect(report.verdict).toBe('reject');
    expect(report.metrics.singleWriterScore).toBe(0);
    expect(report.evidence.conflictingPaths).toContainEqual({
      path: 'src/chunk.ts',
      sliceIds: expect.arrayContaining(['chunk', 'unique']),
    });
  });

  it('rejects a plan whose multi-slice epic lacks an integration seam', () => {
    const plan = clone(loadFixture('layered-todo'));
    const core = plan.epics.find((e) => e.id === 'core')!;
    core.verification = [];

    const report = evaluatePlanShape(plan);
    expect(report.verdict).toBe('reject');
    expect(report.evidence.multiSliceEpicsMissingSeam).toContain('core');
    expect(report.metrics.integrationSeamCoverage).toBeLessThan(1);
  });

  it('rejects a plan with a slice missing its writes declaration', () => {
    const plan = clone(loadFixture('resilient-pipeline'));
    const parse = plan.slices.find((s) => s.id === 'parse')!;
    delete parse.writes;

    const report = evaluatePlanShape(plan);
    expect(report.verdict).toBe('reject');
    expect(report.evidence.slicesMissingWrites).toContain('parse');
    expect(report.metrics.writesCoverage).toBeLessThan(1);
  });

  it('rejects a plan with a dangling dependency (contract error)', () => {
    const plan = clone(loadFixture('layered-todo'));
    const service = plan.slices.find((s) => s.id === 'service')!;
    service.depends_on = [...service.depends_on, 'nonexistent'];

    const report = evaluatePlanShape(plan);
    expect(report.verdict).toBe('reject');
    expect(report.hardFailures.join(' ')).toContain('contract errors');
  });
});

describe('evaluatePlanShape — structural metrics are graded, not gating', () => {
  it('penalizes a transitively-redundant dependency edge', () => {
    const before = evaluatePlanShape(loadFixture('layered-todo'));

    const plan = clone(loadFixture('layered-todo'));
    // service already reaches types via store/validation; this edge is redundant.
    const service = plan.slices.find((s) => s.id === 'service')!;
    service.depends_on = [...service.depends_on, 'types'];

    const after = evaluatePlanShape(plan);
    expect(after.evidence.redundantEdges).toContainEqual({ sliceId: 'service', dependsOn: 'types' });
    expect(after.metrics.redundantDependencyScore).toBeLessThan(before.metrics.redundantDependencyScore);
    expect(after.overall).toBeLessThan(before.overall);
    // A redundant edge is a design smell, not an executability failure.
    expect(after.verdict).toBe('accept');
  });

  it('drops the dependency-signal score for a fully flattened multi-slice plan', () => {
    const plan = clone(loadFixture('parallel-utils'));
    for (const slice of plan.slices) slice.depends_on = [];

    const report = evaluatePlanShape(plan);
    expect(report.metrics.dependencySignalScore).toBe(0);
    expect(report.overall).toBeLessThan(1);
  });

  it('lowers the sharpness score for a slice that writes many files', () => {
    const before = evaluatePlanShape(loadFixture('resilient-pipeline'));

    const plan = clone(loadFixture('resilient-pipeline'));
    const parse = plan.slices.find((s) => s.id === 'parse')!;
    parse.writes = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];

    const after = evaluatePlanShape(plan);
    expect(after.metrics.sliceSharpnessScore).toBeLessThan(before.metrics.sliceSharpnessScore);
  });
});

describe('evaluatePlanShape — monotonicity', () => {
  it('a strictly worse plan never scores higher than its source', () => {
    const good = evaluatePlanShape(loadFixture('layered-todo'));

    // Introduce a single redundant edge — strictly worse on one axis, equal
    // on the rest — and confirm the summary never rises.
    const plan = clone(loadFixture('layered-todo'));
    const cmdAdd = plan.slices.find((s) => s.id === 'cmd-add')!;
    cmdAdd.depends_on = [...cmdAdd.depends_on, 'store']; // service already reaches store
    const worse = evaluatePlanShape(plan);

    expect(worse.overall).toBeLessThanOrEqual(good.overall);
  });
});
