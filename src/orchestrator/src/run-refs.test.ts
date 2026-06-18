import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { brunchRef, gcCookRun, pruneWorktrees } from './run-refs.js';

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

describe('gcCookRun', () => {
  let source: string;

  function git(...args: string[]): string {
    return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: source,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
  function branchExists(ref: string): boolean {
    try {
      git('rev-parse', '--verify', `refs/heads/${ref}`);
      return true;
    } catch {
      return false;
    }
  }
  /** A run rooted at .brunch/cook/runs/<id>/worktree with one nested slice worktree. */
  function seedRun(runId: string): { runDir: string } {
    const runDir = join(source, '.brunch', 'cook', 'runs', runId);
    const parent = join(runDir, 'worktree');
    git('worktree', 'add', '-q', '-b', brunchRef.run(runId), parent, 'HEAD');
    git('worktree', 'add', '-q', '-b', brunchRef.slice(runId, 'a'), join(parent, 'a'), brunchRef.run(runId));
    return { runDir };
  }

  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'brunch-gc-'));
    git('init', '-q', '-b', 'main');
    git('commit', '-q', '--allow-empty', '-m', 'base');
  });
  afterEach(() => rmSync(source, { recursive: true, force: true }));

  it('reclaims run worktrees + slice branches but keeps the run branch artifact', () => {
    const { runDir } = seedRun('r1');
    const artifact = git('rev-parse', brunchRef.run('r1'));

    gcCookRun({ sourceDir: source, runId: 'r1', runDir });

    expect(existsSync(runDir)).toBe(false); // worktree dirs gone
    expect(branchExists(brunchRef.slice('r1', 'a'))).toBe(false); // intermediate slice branch deleted
    expect(branchExists(brunchRef.run('r1'))).toBe(true); // the promoted artifact survives
    expect(git('rev-parse', brunchRef.run('r1'))).toBe(artifact);
  });

  it('leaves an unrelated run untouched', () => {
    const { runDir: r1Dir } = seedRun('r1');
    const { runDir: r2Dir } = seedRun('r2');

    gcCookRun({ sourceDir: source, runId: 'r1', runDir: r1Dir });

    expect(existsSync(r2Dir)).toBe(true);
    expect(branchExists(brunchRef.slice('r2', 'a'))).toBe(true);
    expect(branchExists(brunchRef.run('r2'))).toBe(true);
  });
});
