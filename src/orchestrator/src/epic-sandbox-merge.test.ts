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

import { epicIdsForEpicVerifyMerge, mergeSlicesIntoEpicSandbox } from './epic-sandbox-merge.js';
import type { Plan } from './types.js';

const txtLikePlan: Plan = {
  epics: [
    { id: 'scaffolding', summary: '', depends_on: [], verification: [] },
    { id: 'text-ops', summary: '', depends_on: ['scaffolding'], verification: [] },
  ],
  slices: [
    { id: 'version-flag', epic_id: 'scaffolding', definition: '', depends_on: [], verification: [] },
    { id: 'help-flag', epic_id: 'scaffolding', definition: '', depends_on: [], verification: [] },
    { id: 'reverse', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
    { id: 'count', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
    { id: 'slugify', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
  ],
};

describe('epicIdsForEpicVerifyMerge', () => {
  it('includes only the target epic when there are no epic dependencies', () => {
    expect(epicIdsForEpicVerifyMerge(txtLikePlan, 'scaffolding')).toEqual(['scaffolding']);
  });

  it('includes dependency epics in plan declaration order', () => {
    expect(epicIdsForEpicVerifyMerge(txtLikePlan, 'text-ops')).toEqual(['scaffolding', 'text-ops']);
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

  function seedEpic(parent: string, epicId: string, files: Record<string, string>): void {
    const epicDir = join(parent, epicId);
    for (const [rel, contents] of Object.entries(files)) {
      const abs = join(epicDir, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, contents);
    }
  }

  it('copies disjoint files from each epic worktree into a fresh verify sandbox', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/a.ts': 'export const a = 1;\n' });
    seedEpic(parent, 'epic-b', { 'src/b.ts': 'export const b = 2;\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      epicIds: ['epic-a', 'epic-b'],
    });

    const expected = join(parent, '__epic__', 'epic-b');
    expect(result.epicSandboxDir).toBe(expected);
    expect(result.conflicts).toEqual([]);
    expect(readFileSync(join(expected, 'src/a.ts'), 'utf8')).toBe('export const a = 1;\n');
    expect(readFileSync(join(expected, 'src/b.ts'), 'utf8')).toBe('export const b = 2;\n');
  });

  it('resolves path collisions in epic order (last epic wins) and reports them', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/x.ts': 'A\n' });
    seedEpic(parent, 'epic-b', { 'src/x.ts': 'B\n' });
    seedEpic(parent, 'epic-c', { 'src/x.ts': 'C\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-c',
      epicIds: ['epic-a', 'epic-b', 'epic-c'],
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/x.ts'), 'utf8')).toBe('C\n');
    expect(result.conflicts).toEqual([
      { path: 'src/x.ts', epics: ['epic-a', 'epic-b', 'epic-c'], winner: 'epic-c' },
    ]);
  });

  it('leaves epic worktrees byte-identical after merge', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/a.ts': 'A\n', 'tests/a.test.ts': 'TA\n' });
    seedEpic(parent, 'epic-b', { 'src/a.ts': 'B\n' });

    const before = {
      aSrc: readFileSync(join(parent, 'epic-a', 'src/a.ts'), 'utf8'),
      aTests: readFileSync(join(parent, 'epic-a', 'tests/a.test.ts'), 'utf8'),
      bSrc: readFileSync(join(parent, 'epic-b', 'src/a.ts'), 'utf8'),
    };

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      epicIds: ['epic-a', 'epic-b'],
    });

    expect(readFileSync(join(parent, 'epic-a', 'src/a.ts'), 'utf8')).toBe(before.aSrc);
    expect(readFileSync(join(parent, 'epic-a', 'tests/a.test.ts'), 'utf8')).toBe(before.aTests);
    expect(readFileSync(join(parent, 'epic-b', 'src/a.ts'), 'utf8')).toBe(before.bSrc);
  });

  it('rebuilds the verify sandbox fresh on every call (no cruft from prior merge)', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/a.ts': 'A1\n', 'src/stale.ts': 'stale\n' });

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-a',
      epicIds: ['epic-a'],
    });

    rmSync(join(parent, 'epic-a', 'src/stale.ts'));
    const second = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-a',
      epicIds: ['epic-a'],
    });

    expect(existsSync(join(second.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(second.epicSandboxDir, 'src/stale.ts'))).toBe(false);
  });

  it('skips epics whose worktree does not exist (e.g. halted before any write)', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/a.ts': 'A\n' });
    // epic "epic-b" never created its worktree

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      epicIds: ['epic-a', 'epic-b'],
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
        epicIds: [],
      }),
    ).toThrow(/Invalid epic id/);
  });

  it('rejects reserved __epic__ as a source epic id', () => {
    const parent = makeParent();
    expect(() =>
      mergeSlicesIntoEpicSandbox({
        parentSandboxDir: parent,
        epicId: 'epic-1',
        epicIds: ['__epic__'],
      }),
    ).toThrow(/Invalid epic id: __epic__/);
  });

  it('does not nest other verify merge dirs into the verify sandbox', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/a.ts': 'A\n' });

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      epicIds: ['epic-a'],
    });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-2',
      epicIds: ['epic-a'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'epic-1'))).toBe(false);
  });

  it('ignores symlinks when walking epic worktree files', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/a.ts': 'A\n' });
    writeFileSync(join(parent, 'outside.ts'), 'OUT\n');
    symlinkSync(join(parent, 'outside.ts'), join(parent, 'epic-a', 'escape.link'));

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-a',
      epicIds: ['epic-a'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'escape.link'))).toBe(false);
  });

  it('replaces a file with a directory when later epics need nested paths', () => {
    const parent = makeParent();
    seedEpic(parent, 'epic-a', { 'src/x': 'file\n' });
    seedEpic(parent, 'epic-b', { 'src/x/inner.ts': 'inner\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-b',
      epicIds: ['epic-a', 'epic-b'],
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/x/inner.ts'), 'utf8')).toBe('inner\n');
    expect(result.conflicts).toEqual([]);
  });

  it('merges txt-like scaffolding + text-ops without intra-epic slice collisions', () => {
    const parent = makeParent();
    seedEpic(parent, 'scaffolding', {
      'src/cli.ts': 'version + help\n',
      'tests/version.test.ts': 'v\n',
      'tests/help.test.ts': 'h\n',
    });
    seedEpic(parent, 'text-ops', {
      'src/cli.ts': 'version + help + reverse + count + slugify\n',
      'tests/reverse.test.ts': 'r\n',
      'tests/count.test.ts': 'c\n',
      'tests/slugify.test.ts': 's\n',
    });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'text-ops',
      epicIds: epicIdsForEpicVerifyMerge(txtLikePlan, 'text-ops'),
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/cli.ts'), 'utf8')).toBe(
      'version + help + reverse + count + slugify\n',
    );
    expect(result.conflicts).toEqual([
      { path: 'src/cli.ts', epics: ['scaffolding', 'text-ops'], winner: 'text-ops' },
    ]);
    expect(existsSync(join(result.epicSandboxDir, 'tests/version.test.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'tests/slugify.test.ts'))).toBe(true);
  });
});
