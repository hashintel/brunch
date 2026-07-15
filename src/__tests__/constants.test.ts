import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as constants from '../constants.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('constants — leaf module owns workspace path constants', () => {
  it('owns the workspace DB filename constants', () => {
    expect(constants.WORKSPACE_DB_FILENAME).toBe('brunch-v1.db');
    expect(constants.LEGACY_ALPHA_DB_FILENAME).toBe('data.db');
  });

  // drizzle-kit loads drizzle.config.ts to generate migrations; that load must
  // stay leaf-cheap. Importing the DB filename from the graph runtime pulls in
  // better-sqlite3 (native) just to compute a string, making config loading
  // platform-sensitive (PR 327 review finding).
  it('drizzle.config.ts reads the filename from the leaf module, not the graph runtime', async () => {
    const config = await readFile(join(repoRoot, 'drizzle.config.ts'), 'utf8');
    expect(config).toContain("from './src/constants.js'");
    // No import may reach runtime modules (schema paths as string options are fine).
    expect(config).not.toMatch(/import[^;]*from '\.\/src\/(?!constants\.js)/);
  });
});
