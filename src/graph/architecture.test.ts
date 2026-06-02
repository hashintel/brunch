/**
 * I26-L architectural boundary test.
 *
 * Enforces: only `graph/` imports from `db/` directly.
 * No other `src/` layer may import `db/` modules.
 *
 * SPEC: D52-L, I26-L
 */

import { execSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('I26-L architectural boundary', () => {
  it('no src/ module outside graph/ imports from db/', () => {
    // Find all .ts files importing from db/ (excluding graph/, db/ itself,
    // and test files within graph/)
    const result = execSync(
      `rg --files-with-matches "from ['\\"]\\.\\./db/|from ['\\"]\\.\\./\\.\\./db/|from ['\\"]\\./db/" src/ --glob '*.ts' --glob '!*.test.*' || true`,
      { cwd: process.cwd(), encoding: 'utf-8' },
    );

    const importingFiles = result
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((f) => !f.startsWith('src/graph/') && !f.startsWith('src/db/'));

    expect(importingFiles).toEqual([]);
  });
});
