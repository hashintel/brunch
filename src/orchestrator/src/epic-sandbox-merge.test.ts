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

import { mergeSlicesIntoEpicSandbox } from './epic-sandbox-merge.js';

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

  it('copies disjoint files from each slice into a fresh epic sandbox', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/a.ts': 'export const a = 1;\n' });
    seedSlice(parent, 'b', { 'src/b.ts': 'export const b = 2;\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a', 'b'],
    });

    const expected = join(parent, '__epic__', 'epic-1');
    expect(result.epicSandboxDir).toBe(expected);
    expect(result.conflicts).toEqual([]);
    expect(readFileSync(join(expected, 'src/a.ts'), 'utf8')).toBe('export const a = 1;\n');
    expect(readFileSync(join(expected, 'src/b.ts'), 'utf8')).toBe('export const b = 2;\n');
  });

  it('resolves path collisions in declaration order (last slice wins) and reports them', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/x.ts': 'A\n' });
    seedSlice(parent, 'b', { 'src/x.ts': 'B\n' });
    seedSlice(parent, 'c', { 'src/x.ts': 'C\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a', 'b', 'c'],
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/x.ts'), 'utf8')).toBe('C\n');
    expect(result.conflicts).toEqual([{ path: 'src/x.ts', slices: ['a', 'b', 'c'], winner: 'c' }]);
  });

  it('leaves per-slice worktrees byte-identical after merge', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/a.ts': 'A\n', 'tests/a.test.ts': 'TA\n' });
    seedSlice(parent, 'b', { 'src/a.ts': 'B\n' });

    const before = {
      aSrc: readFileSync(join(parent, 'a', 'src/a.ts'), 'utf8'),
      aTests: readFileSync(join(parent, 'a', 'tests/a.test.ts'), 'utf8'),
      bSrc: readFileSync(join(parent, 'b', 'src/a.ts'), 'utf8'),
    };

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a', 'b'],
    });

    expect(readFileSync(join(parent, 'a', 'src/a.ts'), 'utf8')).toBe(before.aSrc);
    expect(readFileSync(join(parent, 'a', 'tests/a.test.ts'), 'utf8')).toBe(before.aTests);
    expect(readFileSync(join(parent, 'b', 'src/a.ts'), 'utf8')).toBe(before.bSrc);
  });

  it('rebuilds the epic sandbox fresh on every call (no cruft from prior merge)', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/a.ts': 'A1\n', 'src/stale.ts': 'stale\n' });

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a'],
    });

    rmSync(join(parent, 'a', 'src/stale.ts'));
    const second = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a'],
    });

    expect(existsSync(join(second.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(second.epicSandboxDir, 'src/stale.ts'))).toBe(false);
  });

  it('skips slices whose worktree does not exist (e.g. halted before any write)', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/a.ts': 'A\n' });
    // slice "b" never created its worktree

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a', 'b'],
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

  it('rejects reserved __epic__ slice id', () => {
    const parent = makeParent();
    expect(() =>
      mergeSlicesIntoEpicSandbox({
        parentSandboxDir: parent,
        epicId: 'epic-1',
        sliceIds: ['__epic__'],
      }),
    ).toThrow(/Invalid slice id: __epic__/);
  });

  it('does not nest other epic merge dirs into the verify sandbox', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/a.ts': 'A\n' });

    mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a'],
    });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-2',
      sliceIds: ['a'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'epic-1'))).toBe(false);
  });

  it('ignores symlinks when walking slice files', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/a.ts': 'A\n' });
    writeFileSync(join(parent, 'outside.ts'), 'OUT\n');
    symlinkSync(join(parent, 'outside.ts'), join(parent, 'a', 'escape.link'));

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a'],
    });

    expect(existsSync(join(result.epicSandboxDir, 'src/a.ts'))).toBe(true);
    expect(existsSync(join(result.epicSandboxDir, 'escape.link'))).toBe(false);
  });

  it('replaces a file with a directory when later slices need nested paths', () => {
    const parent = makeParent();
    seedSlice(parent, 'a', { 'src/x': 'file\n' });
    seedSlice(parent, 'b', { 'src/x/inner.ts': 'inner\n' });

    const result = mergeSlicesIntoEpicSandbox({
      parentSandboxDir: parent,
      epicId: 'epic-1',
      sliceIds: ['a', 'b'],
    });

    expect(readFileSync(join(result.epicSandboxDir, 'src/x/inner.ts'), 'utf8')).toBe('inner\n');
    expect(result.conflicts).toEqual([]);
  });
});
