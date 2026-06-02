import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseCookArgs, resolveCookMode } from './cook-cli.js';

describe('parseCookArgs', () => {
  it('parses dir only', () => {
    const opts = parseCookArgs(['./fixtures/txt']);
    expect(opts.dir).toContain('fixtures/txt');
    expect(opts.policy).toBe('serial');
    expect(opts.maxRetries).toBe(3);
    expect(opts.verbose).toBe(false);
  });

  it('parses --policy=parallel', () => {
    const opts = parseCookArgs(['./f', '--policy=parallel']);
    expect(opts.policy).toBe('parallel');
  });

  it('parses --policy=serial', () => {
    const opts = parseCookArgs(['./f', '--policy=serial']);
    expect(opts.policy).toBe('serial');
  });

  it('parses --max-retries=5', () => {
    const opts = parseCookArgs(['./f', '--max-retries=5']);
    expect(opts.maxRetries).toBe(5);
  });

  it('throws on missing dir', () => {
    expect(() => parseCookArgs(['--policy=serial'])).toThrow('Usage');
  });

  it('throws on unknown policy', () => {
    expect(() => parseCookArgs(['./f', '--policy=unknown'])).toThrow('Unknown policy');
  });

  it('parses --verbose', () => {
    expect(parseCookArgs(['./f', '--verbose']).verbose).toBe(true);
    expect(parseCookArgs(['./f', '-v']).verbose).toBe(true);
  });

  it("defaults --petrinaut-fold to 'identity'", () => {
    expect(parseCookArgs(['./f']).petrinautFold).toBe('identity');
  });

  it('parses --petrinaut-fold=color', () => {
    expect(parseCookArgs(['./f', '--petrinaut-fold=color']).petrinautFold).toBe('color');
  });

  it('parses --petrinaut-fold=identity', () => {
    expect(parseCookArgs(['./f', '--petrinaut-fold=identity']).petrinautFold).toBe('identity');
  });

  it('throws on unknown --petrinaut-fold value', () => {
    expect(() => parseCookArgs(['./f', '--petrinaut-fold=banana'])).toThrow(/petrinaut-fold/i);
  });
});

describe('resolveCookMode', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function makeTmpDir(prefix = 'cook-resolve-'): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  function initCleanGitRepo(dir: string): void {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    writeFileSync(join(dir, 'README.md'), 'seed\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });
  }

  it('resolves fixture mode when <dir>/plan.yaml exists', () => {
    const d = makeTmpDir();
    writeFileSync(join(d, 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('fixture');
    if (result.mode === 'fixture') {
      expect(result.planPath).toBe(join(d, 'plan.yaml'));
    }
  });

  it('resolves codebase mode when <dir>/.brunch/cook/plan.yaml exists and git working tree is clean', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('codebase');
    if (result.mode === 'codebase') {
      expect(result.planPath).toBe(join(d, '.brunch', 'cook', 'plan.yaml'));
      expect(result.sourceDir).toBe(d);
    }
  });

  it('refuses codebase mode when working tree has uncommitted changes', () => {
    const d = makeTmpDir();
    initCleanGitRepo(d);
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');
    // Introduce dirty state: modify the committed README
    writeFileSync(join(d, 'README.md'), 'modified\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/uncommitted|dirty|working tree/i);
    }
  });

  it('refuses codebase mode when <dir> is not a git repo', () => {
    const d = makeTmpDir();
    mkdirSync(join(d, '.brunch', 'cook'), { recursive: true });
    writeFileSync(join(d, '.brunch', 'cook', 'plan.yaml'), 'epics: []\nslices: []\n');

    const result = resolveCookMode(d);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/git/i);
    }
  });

  it('returns error when no plan found at either location', () => {
    const d = makeTmpDir();

    const result = resolveCookMode(d);
    expect(result.mode).toBe('error');
    if (result.mode === 'error') {
      expect(result.message).toMatch(/plan/i);
    }
  });
});
