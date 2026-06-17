import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { brunchRef, pruneWorktrees } from './run-refs.js';

describe('brunchRef — the run ref namespace', () => {
  it('builds run and slice refs under sibling brunch/{run,slice} segments', () => {
    expect(brunchRef.run('abc')).toBe('brunch/run/abc');
    expect(brunchRef.slice('abc', 'login')).toBe('brunch/slice/abc/login');
  });

  it('a run leaf does not collide with the slice directory of the same run id', () => {
    // git refs are leaf-or-directory: brunch/run/<id> being a leaf must not block
    // brunch/slice/<id>/<sliceId>, since they live under different parents.
    const run = brunchRef.run('r1');
    const slice = brunchRef.slice('r1', 's1');
    expect(slice.startsWith(`${run}/`)).toBe(false);
    expect(run.split('/').slice(0, 2)).toEqual(['brunch', 'run']);
    expect(slice.split('/').slice(0, 2)).toEqual(['brunch', 'slice']);
  });
});

describe('pruneWorktrees', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'brunch-prune-'));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'base'],
      {
        cwd: dir,
      },
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reaps a stale worktree registration so the path can be re-added', () => {
    const wt = join(dir, 'wt');
    execFileSync('git', ['worktree', 'add', '-q', '-b', brunchRef.run('r1'), wt, 'HEAD'], { cwd: dir });
    // Remove the directory out-of-band, leaving a stale registration behind.
    rmSync(wt, { recursive: true, force: true });
    pruneWorktrees(dir);
    // Re-adding the same path now succeeds rather than throwing "already exists".
    expect(() =>
      execFileSync('git', ['worktree', 'add', '-q', '-b', brunchRef.run('r2'), wt, 'HEAD'], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).not.toThrow();
  });
});
