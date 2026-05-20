import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';

import { createWorktree } from './worktree.js';

describe('createWorktree', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('creates worktree directory under .cook/runs/<runId>/worktree/', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'cook-wt-'));
    dirs.push(fixtureDir);

    const info = createWorktree(fixtureDir, 'test-run-1');
    expect(info.runId).toBe('test-run-1');
    expect(info.worktreeDir).toBe(join(fixtureDir, '.cook', 'runs', 'test-run-1', 'worktree'));
    expect(existsSync(info.worktreeDir)).toBe(true);
  });

  it('generates a runId when not provided', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'cook-wt-'));
    dirs.push(fixtureDir);

    const info = createWorktree(fixtureDir);
    expect(info.runId).toBeTruthy();
    expect(existsSync(info.worktreeDir)).toBe(true);
  });
});
