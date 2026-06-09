import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import type { PlanningEnrichment } from './plan-llm-planning.js';
import { loadPlan } from './plan-loader.js';
import { projectPlanFromSpec, type CompletedSpecSnapshot } from './plan-projection.js';
import {
  formatReconciliationWarning,
  reconcilePlan,
  reconciliationWarningCategory,
  type ReconciliationWarning,
} from './plan-reconciliation.js';
import type { Plan } from './types.js';

const emptyEnrichment: PlanningEnrichment = {
  sliceDependencies: [],
  epics: [],
  nonBuildableSliceIds: [],
};

const emptyPlan: Plan = {
  mode: 'greenfield',
  epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
  slices: [],
};

describe('reconcilePlan', () => {
  it('preserves the projected plan mode onto the reconciled plan', () => {
    const greenfield = reconcilePlan({ ...emptyPlan, mode: 'greenfield' }, emptyEnrichment);
    const brownfield = reconcilePlan({ ...emptyPlan, mode: 'brownfield' }, emptyEnrichment);
    expect(greenfield.plan.mode).toBe('greenfield');
    expect(brownfield.plan.mode).toBe('brownfield');
  });

  it('returns an empty plan and zero warnings when both inputs are empty', () => {
    const result = reconcilePlan(emptyPlan, emptyEnrichment);

    expect(result.warnings).toEqual([]);
    expect(result.plan.slices).toEqual([]);
    // Default epic survives so loadPlan round-trips don't break — an
    // empty epics array would still be valid YAML but cook conventions
    // keep at least the fallback epic visible.
    expect(result.plan.epics).toHaveLength(1);
    expect(result.plan.epics[0]!.id).toBe('default');
  });

  it('synthesizes one unit-test verification per surviving slice at tests/<sliceId>.test.ts', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        { id: 'req-1', epic_id: 'default', definition: 'First', depends_on: [], verification: [] },
        { id: 'req-2', epic_id: 'default', definition: 'Second', depends_on: [], verification: [] },
      ],
    };

    const result = reconcilePlan(projected, emptyEnrichment);

    expect(result.plan.slices).toHaveLength(2);
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
    const synthesisWarnings = result.warnings.filter((w) => w.code === 'synthesized-verification-target');
    expect(synthesisWarnings).toHaveLength(2);
  });

  it('enriches slice.definition with verifying-criteria text from the projected verification array', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'req-1',
          epic_id: 'default',
          definition: 'First requirement',
          depends_on: [],
          verification: [
            { kind: 'criterion', target: 'First criterion text' },
            { kind: 'criterion', target: 'Second criterion text' },
          ],
        },
      ],
    };

    const result = reconcilePlan(projected, emptyEnrichment);

    const slice = result.plan.slices[0]!;
    expect(slice.definition).toContain('First requirement');
    expect(slice.definition).toContain('First criterion text');
    expect(slice.definition).toContain('Second criterion text');
    // Original criterion entries are gone; only the synthesized unit-test remains.
    expect(slice.verification).toHaveLength(1);
    expect(slice.verification[0]!.kind).toBe('unit-test');
  });

  it('drops dependsOn references to nonexistent slice ids with a warning', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [{ id: 'req-1', epic_id: 'default', definition: 'A', depends_on: [], verification: [] }],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-1', dependsOn: ['ghost-req-99'] }],
      epics: [],
      nonBuildableSliceIds: [],
    };

    const result = reconcilePlan(projected, enrichment);

    expect(result.plan.slices[0]!.depends_on).toEqual([]);
    expect(result.warnings).toContainEqual({
      code: 'dropped-dependency-nonexistent-id',
      sliceId: 'req-1',
      missingId: 'ghost-req-99',
    });
  });

  it('drops self-loops (slice depending on itself) with a warning', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [{ id: 'req-1', epic_id: 'default', definition: 'A', depends_on: [], verification: [] }],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-1', dependsOn: ['req-1'] }],
      epics: [],
      nonBuildableSliceIds: [],
    };

    const result = reconcilePlan(projected, enrichment);

    expect(result.plan.slices[0]!.depends_on).toEqual([]);
    expect(result.warnings).toContainEqual({
      code: 'dropped-self-loop',
      sliceId: 'req-1',
    });
  });

  it('drops a non-buildable slice with a warning and drops incoming deps onto it', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'req-1',
          epic_id: 'default',
          definition: 'Build A',
          depends_on: [],
          verification: [],
        },
        {
          id: 'req-2',
          epic_id: 'default',
          definition: 'Never lose data',
          depends_on: [],
          verification: [],
        },
      ],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-1', dependsOn: ['req-2'] }],
      epics: [],
      nonBuildableSliceIds: ['req-2'],
    };

    const result = reconcilePlan(projected, enrichment);

    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-1']);
    expect(result.plan.slices[0]!.depends_on).toEqual([]);
    expect(result.warnings).toContainEqual({
      code: 'dropped-non-buildable-slice',
      sliceId: 'req-2',
      definition: 'Never lose data',
    });
    expect(result.warnings).toContainEqual({
      code: 'dropped-dependency-on-non-buildable',
      sliceId: 'req-1',
      nonBuildableId: 'req-2',
    });
  });

  it('breaks a 2-cycle by dropping the incoming edges of the lex-smallest sliceId', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        { id: 'req-a', epic_id: 'default', definition: 'A', depends_on: [], verification: [] },
        { id: 'req-b', epic_id: 'default', definition: 'B', depends_on: [], verification: [] },
      ],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [
        { sliceId: 'req-a', dependsOn: ['req-b'] },
        { sliceId: 'req-b', dependsOn: ['req-a'] },
      ],
      epics: [],
      nonBuildableSliceIds: [],
    };

    const result = reconcilePlan(projected, enrichment);

    const bySliceId = new Map(result.plan.slices.map((s) => [s.id, s] as const));
    // Lex-smallest is 'req-a': drop its incoming dep edge (req-a depends on req-b).
    expect(bySliceId.get('req-a')!.depends_on).toEqual([]);
    expect(bySliceId.get('req-b')!.depends_on).toEqual(['req-a']);
    expect(result.warnings).toContainEqual({
      code: 'cycle-break-dropped-edge',
      sliceId: 'req-a',
      droppedDependsOn: 'req-b',
    });
  });

  it('breaks a 3-cycle deterministically across re-runs', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        { id: 'req-a', epic_id: 'default', definition: 'A', depends_on: [], verification: [] },
        { id: 'req-b', epic_id: 'default', definition: 'B', depends_on: [], verification: [] },
        { id: 'req-c', epic_id: 'default', definition: 'C', depends_on: [], verification: [] },
      ],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [
        { sliceId: 'req-a', dependsOn: ['req-c'] },
        { sliceId: 'req-b', dependsOn: ['req-a'] },
        { sliceId: 'req-c', dependsOn: ['req-b'] },
      ],
      epics: [],
      nonBuildableSliceIds: [],
    };

    const first = reconcilePlan(projected, enrichment);
    const second = reconcilePlan(projected, enrichment);

    expect(first).toEqual(second);

    // Output must be acyclic — assert with a fresh Kahn pass.
    const depsById = new Map(first.plan.slices.map((s) => [s.id, s.depends_on] as const));
    const remaining = new Set(depsById.keys());
    let processedSomething = true;
    while (remaining.size > 0 && processedSomething) {
      processedSomething = false;
      for (const id of [...remaining]) {
        if ((depsById.get(id) ?? []).every((d) => !remaining.has(d))) {
          remaining.delete(id);
          processedSomething = true;
        }
      }
    }
    expect(remaining.size).toBe(0);
  });

  it('drops an empty epic and assigns orphan slices to a synthesized default epic', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        { id: 'req-1', epic_id: 'default', definition: 'A', depends_on: [], verification: [] },
        { id: 'req-2', epic_id: 'default', definition: 'B', depends_on: [], verification: [] },
      ],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [],
      epics: [
        // Covers req-1.
        { id: 'core', summary: 'Core', sliceIds: ['req-1'] },
        // Refers only to a nonexistent slice → empty after filtering.
        { id: 'orphan-epic', summary: 'Orphan', sliceIds: ['ghost-req-99'] },
      ],
      nonBuildableSliceIds: [],
    };

    const result = reconcilePlan(projected, enrichment);

    const epicIds = result.plan.epics.map((e) => e.id);
    expect(epicIds).toContain('core');
    expect(epicIds).toContain('default');
    expect(epicIds).not.toContain('orphan-epic');

    const sliceById = new Map(result.plan.slices.map((s) => [s.id, s] as const));
    expect(sliceById.get('req-1')!.epic_id).toBe('core');
    expect(sliceById.get('req-2')!.epic_id).toBe('default');

    expect(result.warnings).toContainEqual({
      code: 'dropped-empty-epic',
      epicId: 'orphan-epic',
      epicSummary: 'Orphan',
    });
    expect(result.warnings).toContainEqual({
      code: 'orphan-slice-assigned-to-default-epic',
      sliceId: 'req-2',
    });
  });

  it('does not synthesize a default epic when every surviving slice is covered', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [{ id: 'req-1', epic_id: 'default', definition: 'A', depends_on: [], verification: [] }],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-1'] }],
      nonBuildableSliceIds: [],
    };

    const result = reconcilePlan(projected, enrichment);

    expect(result.plan.epics.map((e) => e.id)).toEqual(['core']);
    expect(result.warnings.some((w) => w.code === 'orphan-slice-assigned-to-default-epic')).toBe(false);
  });

  it('returns structurally-equal outputs across two identical calls (determinism pin)', () => {
    const projected: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'req-1',
          epic_id: 'default',
          definition: 'First',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'Crit' }],
        },
        { id: 'req-2', epic_id: 'default', definition: 'Second', depends_on: [], verification: [] },
      ],
    };
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-2', dependsOn: ['req-1'] }],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-1', 'req-2'] }],
      nonBuildableSliceIds: [],
    };

    expect(reconcilePlan(projected, enrichment)).toEqual(reconcilePlan(projected, enrichment));
  });

  it('brunch_graphs corpus end-to-end — round-trips through loadPlan after reconciliation', () => {
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '__fixtures__',
      'brunch-graphs-snapshot.json',
    );
    const snapshot = JSON.parse(readFileSync(fixturePath, 'utf8')) as CompletedSpecSnapshot;
    const projected = projectPlanFromSpec(snapshot);
    expect(projected.slices.length).toBeGreaterThan(2);

    // Hand-craft a representative enrichment: one dep edge, one non-buildable
    // slice, no epic coverage so every surviving slice falls through to the
    // default epic.
    const [firstSlice, secondSlice, thirdSlice, ...rest] = projected.slices;
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: secondSlice!.id, dependsOn: [firstSlice!.id] }],
      epics: [],
      nonBuildableSliceIds: [thirdSlice!.id],
    };

    const result = reconcilePlan(projected, enrichment);

    // (a) Non-buildable slice removed.
    expect(result.plan.slices.map((s) => s.id)).not.toContain(thirdSlice!.id);
    // (b) Every surviving slice carries the synthesized unit-test target.
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
    // (c) Warnings non-empty (synthesis + non-buildable removal at minimum).
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings).toContainEqual({
      code: 'dropped-non-buildable-slice',
      sliceId: thirdSlice!.id,
      definition: thirdSlice!.definition,
    });

    // (d) YAML round-trip via loadPlan preserves the reconciled plan.
    const dir = mkdtempSync(join(tmpdir(), 'plan-reconciliation-'));
    const yamlPath = join(dir, 'plan.yaml');
    writeFileSync(yamlPath, stringifyYaml(result.plan));
    const reloaded = loadPlan(yamlPath);
    expect(reloaded).toEqual(result.plan);

    // Schema-conformance pin: every slice.epic_id resolves to an existing epic.
    const epicIds = new Set(reloaded.epics.map((e) => e.id));
    for (const slice of reloaded.slices) {
      expect(epicIds.has(slice.epic_id)).toBe(true);
    }

    // Silence unused-var lint for `rest` — we intentionally only need three
    // representative slices for this corpus check.
    void rest;
  });
});

describe('reconciliationWarningCategory', () => {
  // One example per code so a new warning code in the union forces an
  // exhaustive-switch update in `reconciliationWarningCategory` AND a
  // matching expectation here.
  const examples: { warning: ReconciliationWarning; expected: 'transformation' | 'synthesis' }[] = [
    {
      warning: { code: 'synthesized-verification-target', sliceId: 'req-1', target: 'tests/req-1.test.ts' },
      expected: 'synthesis',
    },
    {
      warning: { code: 'dropped-dependency-nonexistent-id', sliceId: 'req-1', missingId: 'ghost' },
      expected: 'transformation',
    },
    {
      warning: { code: 'dropped-self-loop', sliceId: 'req-1' },
      expected: 'transformation',
    },
    {
      warning: { code: 'cycle-break-dropped-edge', sliceId: 'req-a', droppedDependsOn: 'req-b' },
      expected: 'transformation',
    },
    {
      warning: { code: 'dropped-dependency-on-non-buildable', sliceId: 'req-1', nonBuildableId: 'req-2' },
      expected: 'transformation',
    },
    {
      warning: { code: 'dropped-non-buildable-slice', sliceId: 'req-2', definition: 'Never lose data' },
      expected: 'transformation',
    },
    {
      warning: { code: 'dropped-empty-epic', epicId: 'orphan', epicSummary: 'Orphan' },
      expected: 'transformation',
    },
    {
      warning: { code: 'orphan-slice-assigned-to-default-epic', sliceId: 'req-1' },
      expected: 'transformation',
    },
  ];

  for (const { warning, expected } of examples) {
    it(`classifies '${warning.code}' as '${expected}'`, () => {
      expect(reconciliationWarningCategory(warning)).toBe(expected);
    });
  }
});

describe('formatReconciliationWarning', () => {
  const examples: { warning: ReconciliationWarning; mustContain: string[] }[] = [
    {
      warning: { code: 'synthesized-verification-target', sliceId: 'req-1', target: 'tests/req-1.test.ts' },
      mustContain: ['synthesized-verification-target', 'req-1', 'tests/req-1.test.ts'],
    },
    {
      warning: { code: 'dropped-dependency-nonexistent-id', sliceId: 'req-1', missingId: 'ghost' },
      mustContain: ['dropped-dependency-nonexistent-id', 'req-1', 'ghost'],
    },
    {
      warning: { code: 'dropped-self-loop', sliceId: 'req-1' },
      mustContain: ['dropped-self-loop', 'req-1'],
    },
    {
      warning: { code: 'cycle-break-dropped-edge', sliceId: 'req-a', droppedDependsOn: 'req-b' },
      mustContain: ['cycle-break-dropped-edge', 'req-a', 'req-b'],
    },
    {
      warning: { code: 'dropped-dependency-on-non-buildable', sliceId: 'req-1', nonBuildableId: 'req-2' },
      mustContain: ['dropped-dependency-on-non-buildable', 'req-1', 'req-2'],
    },
    {
      warning: { code: 'dropped-non-buildable-slice', sliceId: 'req-2', definition: 'Never lose data' },
      mustContain: ['dropped-non-buildable-slice', 'req-2'],
    },
    {
      warning: { code: 'dropped-empty-epic', epicId: 'orphan', epicSummary: 'Orphan' },
      mustContain: ['dropped-empty-epic', 'orphan', 'Orphan'],
    },
    {
      warning: { code: 'orphan-slice-assigned-to-default-epic', sliceId: 'req-1' },
      mustContain: ['orphan-slice-assigned-to-default-epic', 'req-1'],
    },
  ];

  for (const { warning, mustContain } of examples) {
    it(`renders '${warning.code}' as a non-empty line containing code + key fields`, () => {
      const line = formatReconciliationWarning(warning);
      expect(line.length).toBeGreaterThan(0);
      for (const fragment of mustContain) {
        expect(line).toContain(fragment);
      }
    });
  }
});
