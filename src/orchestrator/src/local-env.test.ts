import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadLocalEnvFile } from './local-env.js';

describe('loadLocalEnvFile', () => {
  const tempDirs: string[] = [];

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-local-env-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it('does not override a non-empty shell env value with a local .env value (shell-wins)', () => {
    const cwd = makeTempDir();
    writeFileSync(join(cwd, '.env'), 'PETRINAUT_URL=https://bare.example\n');

    const previousUrl = process.env.PETRINAUT_URL;
    // Simulates an inline `PETRINAUT_URL=… brunch cook …` shell prefix.
    process.env.PETRINAUT_URL = 'https://inline.example/brunch';

    try {
      loadLocalEnvFile(cwd);

      // Shell value wins; the bare-domain .env value does not clobber it.
      expect(process.env.PETRINAUT_URL).toBe('https://inline.example/brunch');
    } finally {
      if (previousUrl === undefined) {
        delete process.env.PETRINAUT_URL;
      } else {
        process.env.PETRINAUT_URL = previousUrl;
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
