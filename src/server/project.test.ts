import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findBrunchProject, initBrunchProject, resolveBrunchProject } from './project.js';

describe('project resolution', () => {
  const tempDirs: string[] = [];

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-test-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  // ── findBrunchProject ───────────────────────────────────────────

  it('returns BrunchProject when .brunch/ exists in cwd', () => {
    const cwd = makeTempDir();
    mkdirSync(join(cwd, '.brunch'));

    const project = findBrunchProject(cwd);

    expect(project).not.toBeNull();
    expect(project!.root).toBe(join(cwd, '.brunch'));
    expect(project!.dbPath).toBe(join(cwd, '.brunch', 'brunch.db'));
    expect(project!.cwd).toBe(cwd);
  });

  it('finds .brunch/ in a parent directory (walk-up)', () => {
    const root = makeTempDir();
    mkdirSync(join(root, '.brunch'));
    const child = join(root, 'packages', 'frontend');
    mkdirSync(child, { recursive: true });

    const project = findBrunchProject(child);

    expect(project).not.toBeNull();
    expect(project!.root).toBe(join(root, '.brunch'));
    expect(project!.cwd).toBe(root);
  });

  it('returns null when no .brunch/ exists up to the walk-up limit', () => {
    const root = makeTempDir();
    // Create a deep path but no .brunch/ anywhere
    const deep = join(root, 'a', 'b', 'c', 'd', 'e', 'f');
    mkdirSync(deep, { recursive: true });

    const project = findBrunchProject(deep);

    expect(project).toBeNull();
  });

  it('does not walk above the filesystem root or home directory', () => {
    // Walking from a tmp dir should never find .brunch/ above tmp
    const cwd = makeTempDir();
    const project = findBrunchProject(cwd);
    expect(project).toBeNull();
  });

  // ── initBrunchProject ───────────────────────────────────────────

  it('creates .brunch/ directory with correct BrunchProject shape', () => {
    const cwd = makeTempDir();

    const project = initBrunchProject(cwd);

    expect(existsSync(project.root)).toBe(true);
    expect(project.root).toBe(join(cwd, '.brunch'));
    expect(project.dbPath).toBe(join(cwd, '.brunch', 'brunch.db'));
    expect(project.cwd).toBe(cwd);
  });

  it('throws when .brunch/ already exists', () => {
    const cwd = makeTempDir();
    mkdirSync(join(cwd, '.brunch'));

    expect(() => initBrunchProject(cwd)).toThrow();
  });

  it('rejects invalid .brunch path shapes during initialization', () => {
    const cwd = makeTempDir();
    writeFileSync(join(cwd, '.brunch'), 'not a directory');

    expect(() => initBrunchProject(cwd)).toThrow('exists but is not a directory');
  });

  // ── resolveBrunchProject ────────────────────────────────────────

  it('creates .brunch/ when none found', () => {
    const cwd = makeTempDir();

    const project = resolveBrunchProject(cwd);

    expect(existsSync(project.root)).toBe(true);
    expect(project.cwd).toBe(cwd);
  });

  it('finds existing .brunch/ without creating a new one', () => {
    const root = makeTempDir();
    mkdirSync(join(root, '.brunch'));
    const child = join(root, 'src');
    mkdirSync(child);

    const project = resolveBrunchProject(child);

    expect(project.root).toBe(join(root, '.brunch'));
    expect(project.cwd).toBe(root);
    // Should not create a second .brunch/ in the child
    expect(existsSync(join(child, '.brunch'))).toBe(false);
  });

  it('rejects invalid .brunch path shapes during walk-up discovery', () => {
    const root = makeTempDir();
    writeFileSync(join(root, '.brunch'), 'not a directory');
    const child = join(root, 'src');
    mkdirSync(child);

    expect(() => resolveBrunchProject(child)).toThrow('exists but is not a directory');
  });
});
