import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkPlan, repairPlan, type ContractFinding } from './plan-contract.js';
import { loadPlan } from './plan-loader.js';
import { bunProfile } from './project-profile.js';
import type { Plan } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', '..', 'fixtures');

const toolchain = bunProfile.toolchain;

function slice(
  id: string,
  epicId: string,
  overrides: Partial<Plan['slices'][number]> = {},
): Plan['slices'][number] {
  return {
    id,
    epic_id: epicId,
    definition: id,
    depends_on: [],
    verification: [{ kind: 'unit-test', target: `tests/${id}.test.ts` }],
    ...overrides,
  };
}

function epic(id: string, overrides: Partial<Plan['epics'][number]> = {}): Plan['epics'][number] {
  return { id, summary: id, depends_on: [], verification: [], ...overrides };
}

function plan(epics: Plan['epics'], slices: Plan['slices']): Plan {
  return { mode: 'greenfield', epics, slices };
}

function codes(findings: ContractFinding[]): string[] {
  return findings.map((finding) => finding.code);
}

describe('checkPlan', () => {
  it('accepts a well-formed single-epic plan', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'e')]));
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('flags a multi-slice epic with no integration verification as a warning under the base profile', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'e'), slice('b', 'e')]));
    const seam = result.findings.find((f) => f.code === 'multi-slice-epic-missing-integration-seam');
    expect(seam).toEqual({
      code: 'multi-slice-epic-missing-integration-seam',
      severity: 'warning',
      epicId: 'e',
    });
    // A warning does not fail the base profile.
    expect(result.ok).toBe(true);
  });

  it('escalates the missing integration seam to an error under the emitted profile', () => {
    const p = plan([epic('e')], [slice('a', 'e'), slice('b', 'e')]);
    const result = checkPlan(p, { profile: 'emitted' });
    const seam = result.findings.find((f) => f.code === 'multi-slice-epic-missing-integration-seam');
    expect(seam?.severity).toBe('error');
    expect(result.ok).toBe(false);
  });

  it('does not flag a multi-slice epic that already carries an integration seam', () => {
    const p = plan(
      [epic('e', { verification: [{ kind: 'integration-test', target: 'tests/e.integration.test.ts' }] })],
      [slice('a', 'e'), slice('b', 'e')],
    );
    expect(checkPlan(p, { profile: 'emitted' }).ok).toBe(true);
  });

  it('does not require an integration seam on a single-slice epic', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'e')]), { profile: 'emitted' });
    expect(codes(result.findings)).not.toContain('multi-slice-epic-missing-integration-seam');
    expect(result.ok).toBe(true);
  });

  it('enforces acyclic depends_on over existing slice ids', () => {
    const p = plan(
      [epic('e')],
      [slice('a', 'e', { depends_on: ['b'] }), slice('b', 'e', { depends_on: ['a'] })],
    );
    const result = checkPlan(p);
    expect(result.ok).toBe(false);
    expect(codes(result.findings)).toContain('dependency-cycle');
  });

  it('flags a self-dependency', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'e', { depends_on: ['a'] })]));
    expect(result.findings).toContainEqual({ code: 'self-dependency', severity: 'error', sliceId: 'a' });
    expect(result.ok).toBe(false);
  });

  it('flags a dependency on a nonexistent slice id', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'e', { depends_on: ['ghost'] })]));
    expect(result.findings).toContainEqual({
      code: 'dangling-dependency',
      severity: 'error',
      sliceId: 'a',
      missingId: 'ghost',
    });
    expect(result.ok).toBe(false);
  });

  it('requires at least one verification target per slice', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'e', { verification: [] })]));
    expect(result.findings).toContainEqual({
      code: 'slice-missing-verification',
      severity: 'error',
      sliceId: 'a',
    });
    expect(result.ok).toBe(false);
  });

  it('requires every slice to belong to an existing epic', () => {
    const result = checkPlan(plan([epic('e')], [slice('a', 'ghost-epic')]));
    expect(result.findings).toContainEqual({
      code: 'slice-missing-epic',
      severity: 'error',
      sliceId: 'a',
      epicId: 'ghost-epic',
    });
    expect(result.ok).toBe(false);
  });

  it('flags an uncovered requirement only when expectations are supplied', () => {
    const p = plan([epic('e')], [slice('req-1', 'e')]);
    expect(checkPlan(p).ok).toBe(true);
    const result = checkPlan(p, { requirementSliceIds: ['req-1', 'req-2'] });
    expect(result.findings).toContainEqual({
      code: 'uncovered-requirement',
      severity: 'error',
      sliceId: 'req-2',
    });
    expect(result.ok).toBe(false);
  });

  it('exempts an explicitly non-buildable requirement from the coverage check', () => {
    const p = plan([epic('e')], [slice('req-1', 'e')]);
    const result = checkPlan(p, { requirementSliceIds: ['req-1', 'req-2'], nonBuildableSliceIds: ['req-2'] });
    expect(result.ok).toBe(true);
  });

  it('is pure — does not mutate the input plan', () => {
    const p = plan([epic('e')], [slice('a', 'e', { depends_on: ['a'] })]);
    const snapshot = structuredClone(p);
    checkPlan(p, { profile: 'emitted' });
    expect(p).toEqual(snapshot);
  });

  it.each(['parallel-utils', 'layered-todo', 'resilient-pipeline'])(
    'accepts reference fixture %s unmodified (base profile)',
    (name) => {
      const loaded = loadPlan(join(fixturesDir, name, 'plan.yaml'));
      const result = checkPlan(loaded);
      expect(result.ok).toBe(true);
    },
  );
});

describe('repairPlan', () => {
  it('synthesizes an integration seam for every multi-slice epic and leaves single-slice epics untouched', () => {
    const p = plan(
      [epic('multi'), epic('solo')],
      [slice('a', 'multi'), slice('b', 'multi'), slice('c', 'solo')],
    );
    const { plan: repaired, repairs } = repairPlan(p, toolchain);

    const multi = repaired.epics.find((e) => e.id === 'multi')!;
    expect(multi.verification).toContainEqual({
      kind: 'integration-test',
      target: toolchain.epicTarget('multi'),
    });
    const solo = repaired.epics.find((e) => e.id === 'solo')!;
    expect(solo.verification).toEqual([]);

    expect(repairs).toContainEqual({
      code: 'synthesized-integration-seam',
      epicId: 'multi',
      target: toolchain.epicTarget('multi'),
    });
    expect(repairs.filter((r) => r.code === 'synthesized-integration-seam')).toHaveLength(1);
  });

  it('does not duplicate an existing integration seam', () => {
    const existing = { kind: 'integration-test', target: 'tests/custom.integration.test.ts' };
    const p = plan([epic('multi', { verification: [existing] })], [slice('a', 'multi'), slice('b', 'multi')]);
    const { plan: repaired, repairs } = repairPlan(p, toolchain);
    expect(repaired.epics[0]!.verification).toEqual([existing]);
    expect(repairs.filter((r) => r.code === 'synthesized-integration-seam')).toHaveLength(0);
  });

  it('mints a verification target for a slice that has none', () => {
    const p = plan([epic('e')], [slice('a', 'e', { verification: [] })]);
    const { plan: repaired, repairs } = repairPlan(p, toolchain);
    expect(repaired.slices[0]!.verification).toEqual([
      { kind: 'unit-test', target: toolchain.sliceTarget('a') },
    ]);
    expect(repairs).toContainEqual({
      code: 'synthesized-verification-target',
      sliceId: 'a',
      target: toolchain.sliceTarget('a'),
    });
  });

  it('drops self and dangling dependency edges', () => {
    const p = plan([epic('e')], [slice('a', 'e', { depends_on: ['a', 'ghost'] })]);
    const { plan: repaired, repairs } = repairPlan(p, toolchain);
    expect(repaired.slices[0]!.depends_on).toEqual([]);
    expect(repairs).toContainEqual({ code: 'dropped-self-loop', sliceId: 'a' });
    expect(repairs).toContainEqual({
      code: 'dropped-dependency-nonexistent-id',
      sliceId: 'a',
      missingId: 'ghost',
    });
  });

  it('breaks cycles deterministically at the lex-smallest slice id', () => {
    const p = plan(
      [epic('e')],
      [slice('req-a', 'e', { depends_on: ['req-b'] }), slice('req-b', 'e', { depends_on: ['req-a'] })],
    );
    const { plan: repaired, repairs } = repairPlan(p, toolchain);
    const byId = new Map(repaired.slices.map((s) => [s.id, s] as const));
    expect(byId.get('req-a')!.depends_on).toEqual([]);
    expect(byId.get('req-b')!.depends_on).toEqual(['req-a']);
    expect(repairs).toContainEqual({
      code: 'cycle-break-dropped-edge',
      sliceId: 'req-a',
      droppedDependsOn: 'req-b',
    });
  });

  it('produces a plan accepted by the strict emitted profile (mechanical class fully repaired)', () => {
    const p = plan(
      [epic('e')],
      [slice('a', 'e', { depends_on: ['b', 'a'], verification: [] }), slice('b', 'e', { depends_on: ['a'] })],
    );
    const { plan: repaired } = repairPlan(p, toolchain);
    expect(checkPlan(repaired, { profile: 'emitted' }).ok).toBe(true);
  });

  it('is idempotent — a second repair makes no further changes', () => {
    const p = plan(
      [epic('e')],
      [
        slice('a', 'e', { depends_on: ['b', 'ghost'], verification: [] }),
        slice('b', 'e', { depends_on: ['a'] }),
      ],
    );
    const first = repairPlan(p, toolchain);
    const second = repairPlan(first.plan, toolchain);
    expect(second.plan).toEqual(first.plan);
    expect(second.repairs).toEqual([]);
  });
});
