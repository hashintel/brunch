import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { sharedEntrySymlinkType } from './cow-copy.js';

const dirs: string[] = [];

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cow-copy-'));
  dirs.push(dir);
  return dir;
}

function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
  const spy = vi.spyOn(process, 'platform', 'get').mockReturnValue(platform);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe('sharedEntrySymlinkType', () => {
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('uses a Windows junction for shared directory entries', () => {
    const root = makeDir();
    const nodeModules = join(root, 'node_modules');
    mkdirSync(nodeModules);

    expect(withPlatform('win32', () => sharedEntrySymlinkType(nodeModules))).toBe('junction');
  });

  it('uses the default link type outside Windows and for files', () => {
    const root = makeDir();
    const file = join(root, 'deps.txt');
    writeFileSync(file, 'deps\n');

    expect(withPlatform('linux', () => sharedEntrySymlinkType(root))).toBeUndefined();
    expect(withPlatform('win32', () => sharedEntrySymlinkType(file))).toBeUndefined();
  });
});
