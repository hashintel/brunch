import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createWorktree } from './worktree.js';

describe('createWorktree', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('creates worktree under baseDir/.cook/runs/<runId>/worktree/', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'cook-wt-'));
    dirs.push(baseDir);

    const info = createWorktree(baseDir, 'test-run-1');
    expect(info.runId).toBe('test-run-1');
    expect(info.runDir).toBe(join(baseDir, '.cook', 'runs', 'test-run-1'));
    expect(info.worktreeDir).toBe(join(baseDir, '.cook', 'runs', 'test-run-1', 'worktree'));
    expect(existsSync(info.worktreeDir)).toBe(true);
  });

  it('generates a runId when not provided', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'cook-wt-'));
    dirs.push(baseDir);

    const info = createWorktree(baseDir);
    expect(info.runId).toBeTruthy();
    expect(existsSync(info.worktreeDir)).toBe(true);
  });

  it('does not write to a separate fixture directory', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'cook-base-'));
    const fixtureDir = mkdtempSync(join(tmpdir(), 'cook-fixture-'));
    dirs.push(baseDir, fixtureDir);

    createWorktree(baseDir, 'isolated-run');

    // Fixture dir must not have a .cook/ directory
    expect(existsSync(join(fixtureDir, '.cook'))).toBe(false);
    // Base dir must have it
    expect(existsSync(join(baseDir, '.cook', 'runs', 'isolated-run', 'worktree'))).toBe(true);
  });
});
