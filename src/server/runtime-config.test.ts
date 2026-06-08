import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  getBackendProxyTarget,
  loadLocalEnvFile,
  resolveBackendPort,
  resolveConfiguredDbPath,
} from './runtime-config.js';

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

  it('loads values from a local .env file when the shell env does not already provide them', () => {
    const cwd = makeTempDir();
    writeFileSync(join(cwd, '.env'), 'ANTHROPIC_API_KEY=file-value\nBRUNCH_PORT=4310\n');

    const previousApiKey = process.env.ANTHROPIC_API_KEY;
    const previousPort = process.env.BRUNCH_PORT;

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.BRUNCH_PORT;

    try {
      loadLocalEnvFile(cwd);

      expect(process.env.ANTHROPIC_API_KEY).toBe('file-value');
      expect(process.env.BRUNCH_PORT).toBe('4310');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previousApiKey;
      }

      if (previousPort === undefined) {
        delete process.env.BRUNCH_PORT;
      } else {
        process.env.BRUNCH_PORT = previousPort;
      }
    }
  });

  it('preserves shell env values over non-empty values from a local .env file', () => {
    const cwd = makeTempDir();
    writeFileSync(join(cwd, '.env'), 'ANTHROPIC_API_KEY=file-value\n');

    const previousApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'shell-value';

    try {
      loadLocalEnvFile(cwd);

      expect(process.env.ANTHROPIC_API_KEY).toBe('shell-value');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previousApiKey;
      }
    }
  });

  it('does not override shell env values with blank placeholders from a local .env file', () => {
    const cwd = makeTempDir();
    writeFileSync(join(cwd, '.env'), 'ANTHROPIC_API_KEY=\nBRUNCH_PORT=\n');

    const previousApiKey = process.env.ANTHROPIC_API_KEY;
    const previousPort = process.env.BRUNCH_PORT;

    process.env.ANTHROPIC_API_KEY = 'shell-value';
    process.env.BRUNCH_PORT = '3000';

    try {
      loadLocalEnvFile(cwd);

      expect(process.env.ANTHROPIC_API_KEY).toBe('shell-value');
      expect(process.env.BRUNCH_PORT).toBe('3000');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previousApiKey;
      }

      if (previousPort === undefined) {
        delete process.env.BRUNCH_PORT;
      } else {
        process.env.BRUNCH_PORT = previousPort;
      }
    }
  });
});
