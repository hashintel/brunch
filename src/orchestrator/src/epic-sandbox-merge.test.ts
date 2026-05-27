import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  epicIdsForEpicVerifyMerge,
  mergeSlicesIntoEpicSandbox,
  seedSliceSandboxFromDeps,
  sliceIdsForEpicVerifyMerge,
} from './epic-sandbox-merge.js';
import type { Plan } from './types.js';

const txtLikePlan: Plan = {
  epics: [
    { id: 'scaffolding', summary: '', depends_on: [], verification: [] },
    { id: 'text-ops', summary: '', depends_on: ['scaffolding'], verification: [] },
  ],
  slices: [
    { id: 'version-flag', epic_id: 'scaffolding', definition: '', depends_on: [], verification: [] },
    {
      id: 'help-flag',
      epic_id: 'scaffolding',
      definition: '',
      depends_on: ['version-flag'],
      verification: [],
    },
    { id: 'reverse', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
    { id: 'count', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
    { id: 'slugify', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
  ],
};

const crossEpicSliceDepPlan: Plan = {
  epics: [
    { id: 'epic-a', summary: '', depends_on: [], verification: [] },
    { id: 'epic-b', summary: '', depends_on: [], verification: [] },
  ],
  slices: [
    { id: 'slice-a', epic_id: 'epic-a', definition: '', depends_on: [], verification: [] },
    { id: 'slice-b', epic_id: 'epic-b', definition: '', depends_on: ['slice-a'], verification: [] },
  ],
};

describe('epicIdsForEpicVerifyMerge', () => {
  it('includes only the target epic when there are no epic dependencies', () => {
    expect(epicIdsForEpicVerifyMerge(txtLikePlan, 'scaffolding')).toEqual(['scaffolding']);
  });

  it('includes dependency epics in plan declaration order', () => {
    expect(epicIdsForEpicVerifyMerge(txtLikePlan, 'text-ops')).toEqual(['scaffolding', 'text-ops']);
  });

  it('includes epics reachable only via slice depends_on', () => {
    expect(epicIdsForEpicVerifyMerge(crossEpicSliceDepPlan, 'epic-b')).toEqual(['epic-a', 'epic-b']);
  });

  it('tolerates cyclic slice depends_on without stack overflow', () => {
    const cyclicPlan: Plan = {
      epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
      slices: [
        { id: 'a', epic_id: 'e1', definition: '', depends_on: ['b'], verification: [] },
        { id: 'b', epic_id: 'e1', definition: '', depends_on: ['a'], verification: [] },
      ],
    };
    expect(() => epicIdsForEpicVerifyMerge(cyclicPlan, 'e1')).not.toThrow();
    expect(epicIdsForEpicVerifyMerge(cyclicPlan, 'e1')).toEqual(['e1']);
  });
});

describe('sliceIdsForEpicVerifyMerge', () => {
  it('lists slices from dependency epics then target epic in plan order', () => {
    expect(sliceIdsForEpicVerifyMerge(txtLikePlan, 'text-ops')).toEqual([
      'version-flag',
      'help-flag',
      'reverse',
      'count',
      'slugify',
    ]);
  });

  it('includes cross-epic slice dependencies', () => {
    expect(sliceIdsForEpicVerifyMerge(crossEpicSliceDepPlan, 'epic-b')).toEqual(['slice-a', 'slice-b']);
  });
});

describe('seedSliceSandboxFromDeps', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('copies completed dependency slice files into the target slice sandbox', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'version\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    const sliceDir = seedSliceSandboxFromDeps(parent, txtLikePlan, slice);

    expect(sliceDir).toBe(join(parent, 'help-flag'));
    expect(readFileSync(join(sliceDir, 'src/cli.ts'), 'utf8')).toBe('version\n');
  });

  it('preserveExisting keeps slice-owned files and edits on dep paths', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'dep\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);
    writeFileSync(join(parent, 'help-flag', 'src/stale.ts'), 'slice-owned\n');
    writeFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'slice edit\n');

    seedSliceSandboxFromDeps(parent, txtLikePlan, slice, { preserveExisting: true });

    expect(readFileSync(join(parent, 'help-flag', 'src/stale.ts'), 'utf8')).toBe('slice-owned\n');
    expect(readFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'utf8')).toBe('slice edit\n');
  });

  it('preserveExisting keeps slice modifications when re-seeding before tests', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'dep\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);
    writeFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'slice edit\n');

    seedSliceSandboxFromDeps(parent, txtLikePlan, slice, { preserveExisting: true });

    expect(readFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'utf8')).toBe('slice edit\n');
  });

  it('uses plan order when multiple deps share a path', () => {
    const plan: Plan = {
      epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
      slices: [
        { id: 'dep-b', epic_id: 'e1', definition: '', depends_on: [], verification: [] },
        { id: 'dep-a', epic_id: 'e1', definition: '', depends_on: [], verification: [] },
        {
          id: 'target',
          epic_id: 'e1',
          definition: '',
          depends_on: ['dep-b', 'dep-a'],
          verification: [],
        },
      ],
    };
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'dep-b'), { recursive: true });
    writeFileSync(join(parent, 'dep-b', 'shared.txt'), 'B\n');
    mkdirSync(join(parent, 'dep-a'), { recursive: true });
    writeFileSync(join(parent, 'dep-a', 'shared.txt'), 'A\n');

    const slice = plan.slices.find((s) => s.id === 'target')!;
    seedSliceSandboxFromDeps(parent, plan, slice);

    expect(readFileSync(join(parent, 'target', 'shared.txt'), 'utf8')).toBe('A\n');
  });

  it('reset re-seed removes orphaned slice files from a prior rework attempt', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'dep\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);
    writeFileSync(join(parent, 'help-flag', 'src/stale.ts'), 'orphan\n');
    writeFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'bad edit\n');

    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);

    expect(existsSync(join(parent, 'help-flag', 'src/stale.ts'))).toBe(false);
    expect(readFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'utf8')).toBe('dep\n');
  });
});

describe('mergeSlicesIntoEpicSandbox', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function makeParent(): string {
    const runDir = mkdtempSync(join(tmpdir(), 'cook-merge-'));
    dirs.push(runDir);
    const parent = join(runDir, 'worktree');
    mkdirSync(parent, { recursive: true });
    return parent;
  }

  function seedSlice(parent: string, sliceId: string, files: Record<string, string>): void {
    const sliceDir = join(parent, sliceId);
    for (const [rel, contents] of Object.entries(files)) {
      const abs = join(sliceDir, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, contents);
    }
  }

  it('copies disjoint files from each slice worktree into a fresh verify sandbox', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/a.ts': 'export const a = 1;\n' });
    seedSlice(parent, 'slice-b', { 'src/b.ts': 'export const b = 2;\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      sliceIds: ['slice-a', 'slice-b'],
    });

    const expected = join(parent, '__epic__', 'epic-b');
    expect(result.epicSandboxDir).toBe(expected);
    expect(result.conflicts).toEqual([]);
    expect(readFileSync(join(expected, 'src/a.ts'), 'utf8')).toBe('export const a = 1;\n');
    expect(readFileSync(join(expected, 'src/b.ts'), 'utf8')).toBe('export const b = 2;\n');
  });

  it('resolves path collisions in slice order (last slice wins) and reports them', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/x.ts': 'A\n' });
    seedSlice(parent, 'slice-b', { 'src/x.ts': 'B\n' });
    seedSlice(parent, 'slice-c', { 'src/x.ts': 'C\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-c',
      sliceIds: ['slice-a', 'slice-b', 'slice-c'],
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/x.ts'), 'utf8')).toBe('C\n');
    expect(result.conflicts).toEqual([
      { path: 'src/x.ts', slices: ['slice-a', 'slice-b', 'slice-c'], winner: 'slice-c' },
    ]);
  });

  it('leaves slice worktrees byte-identical after merge', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/a.ts': 'A\n', 'tests/a.test.ts': 'TA\n' });
    seedSlice(parent, 'slice-b', { 'src/a.ts': 'B\n' });

    const before = {
      aSrc: readFileSync(join(parent, 'slice-a', 'src/a.ts'), 'utf8'),
      aTests: readFileSync(join(parent, 'slice-a', 'tests/a.test.ts'), 'utf8'),
      bSrc: readFileSync(join(parent, 'slice-b', 'src/a.ts'), 'utf8'),
    };

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      sliceIds: ['slice-a', 'slice-b'],
    });

    expect(readFileSync(join(parent, 'slice-a', 'src/a.ts'), 'utf8')).toBe(before.aSrc);
    expect(readFileSync(join(parent, 'slice-a', 'tests/a.test.ts'), 'utf8')).toBe(before.aTests);
    expect(readFileSync(join(parent, 'slice-b', 'src/a.ts'), 'utf8')).toBe(before.bSrc);
  });

  it('rebuilds the verify sandbox fresh on every call (no cruft from prior merge)', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/a.ts': 'A1\n', 'src/stale.ts': 'stale\n' });

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-a',
      sliceIds: ['slice-a'],
    });

    rmSync(join(parent, 'slice-a', 'src/stale.ts'));
    const second = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-a',
      sliceIds: ['slice-a'],
    });

    expect(existsSync(join(second.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(second.epicSandboxDir, 'src/stale.ts'))).toBe(false);
  });

  it('skips slices whose worktree does not exist (e.g. halted before any write)', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/a.ts': 'A\n' });
    // slice "slice-b" never created its worktree

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      sliceIds: ['slice-a', 'slice-b'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('rejects epic ids that escape the parent sandbox', () => {
    const parent = makeParent();
    expect(() =>
      mergeSlicesIntoEpicSandbox({
        parentSandboxDir: parent,
        epicId: '..',
        sliceIds: [],
      }),
    ).toThrow(/Invalid epic id/);
  });

  it('rejects reserved __epic__ as a source slice id', () => {
    const parent = makeParent();
    expect(() =>
      mergeSlicesIntoEpicSandbox({
        parentSandboxDir: parent,
        epicId: 'epic-1',
        sliceIds: ['__epic__'],
      }),
    ).toThrow(/Invalid slice id: __epic__/);
  });

  it('does not nest other verify merge dirs into the verify sandbox', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/a.ts': 'A\n' });

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['slice-a'],
    });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-2',
      sliceIds: ['slice-a'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'epic-1'))).toBe(false);
  });

  it('ignores symlinks when walking slice worktree files', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/a.ts': 'A\n' });
    writeFileSync(join(parent, 'outside.ts'), 'OUT\n');
    symlinkSync(join(parent, 'outside.ts'), join(parent, 'slice-a', 'escape.link'));

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-a',
      sliceIds: ['slice-a'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'escape.link'))).toBe(false);
  });

  it('replaces a file with a directory when later slices need nested paths', () => {
    const parent = makeParent();
    seedSlice(parent, 'slice-a', { 'src/x': 'file\n' });
    seedSlice(parent, 'slice-b', { 'src/x/inner.ts': 'inner\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      sliceIds: ['slice-a', 'slice-b'],
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/x/inner.ts'), 'utf8')).toBe('inner\n');
    expect(result.conflicts).toEqual([]);
  });

  it('merges txt-like scaffolding + text-ops without intra-epic slice collisions', () => {
    const parent = makeParent();
    seedSlice(parent, 'version-flag', {
      'src/cli.ts': 'version\n',
      'tests/version.test.ts': 'v\n',
    });
    seedSlice(parent, 'help-flag', {
      'src/cli.ts': 'version + help\n',
      'tests/help.test.ts': 'h\n',
    });
    seedSlice(parent, 'reverse', {
      'src/cli.ts': 'version + help + reverse\n',
      'tests/reverse.test.ts': 'r\n',
    });
    seedSlice(parent, 'count', { 'tests/count.test.ts': 'c\n' });
    seedSlice(parent, 'slugify', { 'tests/slugify.test.ts': 's\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'text-ops',
      sliceIds: sliceIdsForEpicVerifyMerge(txtLikePlan, 'text-ops'),
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/cli.ts'), 'utf8')).toBe(
      'version + help + reverse\n',
    );
    expect(result.conflicts).toEqual([
      { path: 'src/cli.ts', slices: ['version-flag', 'help-flag', 'reverse'], winner: 'reverse' },
    ]);
    expect(existsSync(join(result.epicSandboxDir, 'tests/version.test.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'tests/slugify.test.ts'))).toBe(true);
  });
});
