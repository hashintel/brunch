import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { promoteGreenfieldRun } from './promote-run.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'cook-sandbox-'));
  dirs.push(d);
  writeFileSync(join(d, 'index.ts'), 'export const x = 1;\n');
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'a.ts'), 'a\n');
  return d;
}

function tmpTarget(): string {
  const d = mkdtempSync(join(tmpdir(), 'cook-target-'));
  dirs.push(d);
  return d;
}

describe('promoteGreenfieldRun', () => {
  it('promotes the run tree into an empty target as an initial git commit', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();

    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    expect(readFileSync(join(target, 'index.ts'), 'utf8')).toContain('export const x');
    expect(existsSync(join(target, 'src', 'a.ts'))).toBe(true);
    expect(existsSync(join(target, '.git'))).toBe(true);
    const log = execFileSync('git', ['log', '--oneline'], { cwd: target, encoding: 'utf8' });
    expect(log.trim().length).toBeGreaterThan(0);
    expect(result.target).toBe(target);
    expect(result.branch.length).toBeGreaterThan(0);
  });

  it('refuses a non-empty target without --force', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    writeFileSync(join(target, 'existing.txt'), 'keep\n');

    expect(() => promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false })).toThrow(
      /force|empty/i,
    );
  });

  it('lands on a cook/<runId> branch in an existing repo with --force, leaving the original branch intact', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });
    writeFileSync(join(target, 'existing.txt'), 'keep\n');
    execFileSync('git', ['add', '.'], { cwd: target });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'existing'], { cwd: target });

    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: true });

    expect(result.branch).toBe('cook/r1');
    expect(existsSync(join(target, 'index.ts'))).toBe(true);
    expect(execFileSync('git', ['branch', '--list'], { cwd: target, encoding: 'utf8' })).toContain('main');
  });
});
