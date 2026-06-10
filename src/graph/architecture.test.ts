/**
 * I26-L architectural boundary test.
 *
 * Enforces: only `graph/` imports from `db/` directly.
 * No other `src/` layer may import `db/` modules.
 *
 * SPEC: D52-L, I26-L
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('I26-L architectural boundary', () => {
  it('graph schema kinds is a zero-import taxonomy leaf', () => {
    expect(existsSync('src/graph/schema/kinds.ts')).toBe(true);
    const result = execSync(`rg "^import\\s" src/graph/schema/kinds.ts || true`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });

    expect(result.trim()).toBe('');
  });

  it('db imports from graph only through graph/schema/kinds.ts', () => {
    const result = execSync(
      `rg --files-with-matches "from ['\\"]\\.\\./graph/" src/db/ --glob '*.ts' || true`,
      { cwd: process.cwd(), encoding: 'utf-8' },
    );

    const forbiddenImports = result
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((file) => file !== 'src/db/schema.ts');

    const schemaImports = execSync(`rg "from ['\\"]\\.\\./graph/" src/db/schema.ts || true`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);

    expect(forbiddenImports).toEqual([]);
    expect(schemaImports).toEqual([expect.stringContaining('../graph/schema/kinds.js')]);
  });

  it('db/schema.ts does not own domain enum const arrays', () => {
    const result = execSync(
      `rg "export const (INTENT_KINDS|ORACLE_KINDS|DESIGN_KINDS|PLAN_KINDS|NODE_PLANES|NODE_BASES|EDGE_CATEGORIES|EDGE_STANCES|READINESS_GRADES|READINESS_BANDS|LENS_AFFINITIES|GAP_DISPOSITIONS|GAP_PREDICATE_KINDS)" src/db/schema.ts || true`,
      { cwd: process.cwd(), encoding: 'utf-8' },
    );

    expect(result.trim()).toBe('');
  });

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

  it('spec writes live only in CommandExecutor', () => {
    const result = execSync(
      `rg --files-with-matches "\\.(insert|update|delete)\\(schema\\.specs\\)|\\.(insert|update|delete)\\(specs\\)" src/ --glob '*.ts' --glob '!*.test.*' || true`,
      { cwd: process.cwd(), encoding: 'utf-8' },
    );

    const writingFiles = result
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((f) => f !== 'src/graph/command-executor.ts');

    expect(writingFiles).toEqual([]);
  });
});
