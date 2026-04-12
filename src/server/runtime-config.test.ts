import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveConfiguredDbPath } from './runtime-config.js';

describe('runtime config', () => {
  const tempDirs: string[] = [];

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-runtime-config-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to the local .brunch project when BRUNCH_DB is empty', () => {
    const cwd = makeTempDir();

    const dbPath = resolveConfiguredDbPath('', cwd);

    expect(dbPath).toBe(join(cwd, '.brunch', 'brunch.db'));
    expect(existsSync(join(cwd, '.brunch'))).toBe(true);
  });

  it('falls back to the local .brunch project when BRUNCH_DB is whitespace', () => {
    const cwd = makeTempDir();

    const dbPath = resolveConfiguredDbPath('   ', cwd);

    expect(dbPath).toBe(join(cwd, '.brunch', 'brunch.db'));
    expect(existsSync(join(cwd, '.brunch'))).toBe(true);
  });

  it('keeps an explicit BRUNCH_DB path when one is provided', () => {
    const cwd = makeTempDir();

    expect(resolveConfiguredDbPath('/tmp/custom.db', cwd)).toBe('/tmp/custom.db');
    expect(existsSync(join(cwd, '.brunch'))).toBe(false);
  });
});
