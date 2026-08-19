import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pathExists } from '../path-exists.js';

// The consolidated owner replaced 24 private copies whose bodies were all byte-identical,
// so these tests pin the contract the copies only ever stated implicitly. The
// directory and empty-file cases are the load-bearing ones: they are where this
// predicate parts company with `source-policy.ts`'s stricter private check, which
// requires the path to read as UTF-8 text and therefore answers false for both.
describe('pathExists', () => {
  let root: string;

  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'path-exists-')));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('answers true for an existing file', async () => {
    const file = join(root, 'plan.json');
    await writeFile(file, '{}');
    expect(await pathExists(file)).toBe(true);
  });

  it('answers true for a directory and for an empty file', async () => {
    const directory = join(root, 'dir');
    const empty = join(root, 'empty');
    await mkdir(directory);
    await writeFile(empty, '');
    expect(await pathExists(directory)).toBe(true);
    expect(await pathExists(empty)).toBe(true);
  });

  it('answers false for a missing path', async () => {
    expect(await pathExists(join(root, 'absent'))).toBe(false);
  });

  it('follows symlinks, so a link to an existing target exists and a dangling link does not', async () => {
    const target = join(root, 'target');
    await writeFile(target, 'x');
    await symlink(target, join(root, 'live-link'));
    await symlink(join(root, 'absent'), join(root, 'dangling-link'));
    expect(await pathExists(join(root, 'live-link'))).toBe(true);
    expect(await pathExists(join(root, 'dangling-link'))).toBe(false);
  });
});
