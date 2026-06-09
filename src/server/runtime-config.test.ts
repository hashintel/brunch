import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getBackendProxyTarget, resolveBackendPort, resolveConfiguredDbPath } from './runtime-config.js';

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

  it('prefers BRUNCH_PORT for the backend port and Vite proxy target', () => {
    const env = { BRUNCH_PORT: '4310', PORT: '3999' } satisfies NodeJS.ProcessEnv;

    expect(resolveBackendPort(env)).toBe(4310);
    expect(getBackendProxyTarget(env)).toBe('http://localhost:4310');
  });

  it('falls back to PORT when BRUNCH_PORT is unset', () => {
    const env = { PORT: '4123' } satisfies NodeJS.ProcessEnv;

    expect(resolveBackendPort(env)).toBe(4123);
    expect(getBackendProxyTarget(env)).toBe('http://localhost:4123');
  });

  it('uses the default backend port when no explicit port is configured', () => {
    expect(resolveBackendPort({})).toBe(3000);
    expect(getBackendProxyTarget({})).toBe('http://localhost:3000');
  });

  it('rejects invalid explicit backend ports', () => {
    expect(() => resolveBackendPort({ BRUNCH_PORT: 'not-a-port' })).toThrow('Invalid BRUNCH_PORT value');
    expect(() => resolveBackendPort({ PORT: '70000' })).toThrow('Invalid PORT value');
  });
});
