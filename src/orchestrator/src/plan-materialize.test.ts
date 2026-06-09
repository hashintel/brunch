// FE-829 slice 4B: tests for deterministic materialization of an architect draft.

import { describe, expect, it } from 'vitest';

import type { ArchitectDraft } from './plan-architect.js';
import { materializeArchitectedPlan } from './plan-materialize.js';
import { bunProfile } from './project-profile.js';
import type { Plan } from './types.js';

const toolchain = bunProfile.toolchain;

const projected: Plan = {
  mode: 'greenfield',
  epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
  slices: [
    {
      id: 'req-1',
      epic_id: 'default',
      definition: 'First requirement',
      depends_on: [],
      verification: [{ kind: 'criterion', target: 'renders fast' }],
    },
    { id: 'req-2', epic_id: 'default', definition: 'Second requirement', depends_on: [], verification: [] },
  ],
};

function draft(overrides: Partial<ArchitectDraft> = {}): ArchitectDraft {
  return {
    epics: [{ id: 'core', summary: 'Core' }],
    slices: [
      {
        id: 'scaffold',
        epic_id: 'core',
        definition: 'setup',
        depends_on: [],
        writes: ['package.json'],
        derivedFrom: [],
      },
      {
        id: 'a',
        epic_id: 'core',
        definition: 'A',
        depends_on: ['scaffold'],
        writes: ['src/a.ts'],
        derivedFrom: ['req-1'],
      },
      {
        id: 'b',
        epic_id: 'core',
        definition: 'B',
        depends_on: ['scaffold'],
        writes: ['src/b.ts'],
        derivedFrom: ['req-2'],
      },
    ],
    nonBuildableRequirementIds: [],
    ...overrides,
  };
}

describe('materializeArchitectedPlan', () => {
  it('keeps authored ids, preserves writes, and synthesizes verification targets', () => {
    const { plan } = materializeArchitectedPlan(projected, draft(), toolchain);
    expect(plan.slices.map((s) => s.id)).toEqual(['scaffold', 'a', 'b']);
    expect(plan.slices.find((s) => s.id === 'a')!.writes).toEqual(['src/a.ts']);
    for (const slice of plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
  });

  it('computes coverage from derivedFrom (a req covered by many slices counts once)', () => {
    const d = draft();
    d.slices[2]!.derivedFrom = ['req-1']; // both a and b now cover req-1; req-2 uncovered
    const { coverage } = materializeArchitectedPlan(projected, d, toolchain);
    expect(coverage.requirementIds).toEqual(['req-1', 'req-2']);
    expect([...coverage.coveredRequirementIds].sort()).toEqual(['req-1']);
  });

  it('honors explicit non-buildable requirement ids (filtered to known ids)', () => {
    const { coverage } = materializeArchitectedPlan(
      projected,
      draft({ nonBuildableRequirementIds: ['req-2', 'req-999'] }),
      toolchain,
    );
    expect(coverage.nonBuildableRequirementIds).toEqual(['req-2']);
  });

  it('drops an unknown requirement ref with a warning but keeps the slice', () => {
    const d = draft();
    d.slices[1]!.derivedFrom = ['req-1', 'req-999'];
    const { plan, warnings } = materializeArchitectedPlan(projected, d, toolchain);
    expect(warnings).toContainEqual({
      code: 'dropped-unknown-requirement-ref',
      sliceId: 'a',
      requirementId: 'req-999',
    });
    expect(plan.slices.map((s) => s.id)).toContain('a');
  });

  it('appends requirement criteria into the derived slice definition', () => {
    const { plan } = materializeArchitectedPlan(projected, draft(), toolchain);
    expect(plan.slices.find((s) => s.id === 'a')!.definition).toContain('renders fast');
  });

  it('drops self/dangling deps and assigns unknown-epic slices to the default epic', () => {
    const d = draft();
    d.slices[1]!.depends_on = ['a', 'ghost'];
    d.slices[2]!.epic_id = 'nonexistent';
    const { plan, warnings } = materializeArchitectedPlan(projected, d, toolchain);
    expect(plan.slices.find((s) => s.id === 'a')!.depends_on).toEqual([]);
    expect(warnings).toContainEqual({ code: 'dropped-self-loop', sliceId: 'a' });
    expect(warnings).toContainEqual({
      code: 'dropped-dependency-nonexistent-id',
      sliceId: 'a',
      missingId: 'ghost',
    });
    expect(plan.slices.find((s) => s.id === 'b')!.epic_id).toBe('default');
    expect(plan.epics.map((e) => e.id)).toContain('default');
  });

  it('preserves authored cross-epic dependencies', () => {
    const d = draft({
      epics: [
        { id: 'core', summary: 'Core' },
        { id: 'cli', summary: 'CLI', depends_on: ['core'] },
      ],
    });
    d.slices.push({
      id: 'c',
      epic_id: 'cli',
      definition: 'C',
      depends_on: [],
      writes: ['src/cli.ts'],
      derivedFrom: [],
    });
    const { plan } = materializeArchitectedPlan(projected, d, toolchain);
    expect(plan.epics.find((e) => e.id === 'cli')!.depends_on).toEqual(['core']);
    expect(plan.epics.find((e) => e.id === 'core')!.depends_on).toEqual([]);
  });

  it('drops epic deps on dropped/empty epics and breaks epic cycles', () => {
    const d = draft({
      epics: [
        { id: 'core', summary: 'Core', depends_on: ['cli'] },
        { id: 'cli', summary: 'CLI', depends_on: ['core', 'ghost'] },
      ],
    });
    d.slices.push({
      id: 'c',
      epic_id: 'cli',
      definition: 'C',
      depends_on: [],
      writes: ['src/cli.ts'],
      derivedFrom: [],
    });
    const { plan, warnings } = materializeArchitectedPlan(projected, d, toolchain);
    const core = plan.epics.find((e) => e.id === 'core')!;
    const cli = plan.epics.find((e) => e.id === 'cli')!;
    // `ghost` is not a surviving epic → dropped with a typed warning (never
    // silently); the core↔cli cycle is broken deterministically so at most
    // one edge survives.
    expect(cli.depends_on).not.toContain('ghost');
    expect(warnings).toContainEqual({
      code: 'dropped-epic-dependency-nonexistent-id',
      epicId: 'cli',
      missingId: 'ghost',
    });
    const edgeCount = core.depends_on.length + cli.depends_on.length;
    expect(edgeCount).toBeLessThanOrEqual(1);
  });

  it('warns when an epic gate points at an epic dropped for being empty', () => {
    const d = draft({
      epics: [
        { id: 'core', summary: 'Core' },
        { id: 'cli', summary: 'CLI', depends_on: ['core', 'docs'] },
        { id: 'docs', summary: 'Docs' }, // no slices → dropped as empty
      ],
    });
    d.slices.push({
      id: 'c',
      epic_id: 'cli',
      definition: 'C',
      depends_on: [],
      writes: ['src/cli.ts'],
      derivedFrom: [],
    });
    const { plan, warnings } = materializeArchitectedPlan(projected, d, toolchain);
    expect(plan.epics.map((e) => e.id)).not.toContain('docs');
    expect(plan.epics.find((e) => e.id === 'cli')!.depends_on).toEqual(['core']);
    expect(warnings).toContainEqual({
      code: 'dropped-epic-dependency-nonexistent-id',
      epicId: 'cli',
      missingId: 'docs',
    });
  });

  it('is pure — does not mutate the projected plan or the draft', () => {
    const d = draft();
    const dSnapshot = structuredClone(d);
    const pSnapshot = structuredClone(projected);
    materializeArchitectedPlan(projected, d, toolchain);
    expect(d).toEqual(dSnapshot);
    expect(projected).toEqual(pSnapshot);
  });
});
