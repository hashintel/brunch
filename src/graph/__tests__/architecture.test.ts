/**
 * I26-L architectural boundary test.
 *
 * Covers the D52-L/I26-L invariants that are not expressible as static lint
 * rules: graph/schema/kinds.ts leaf purity, the db→graph kinds-only edge, the
 * absence of enum const arrays in db/schema.ts, and spec writes confined to
 * CommandExecutor. The blanket "only graph/ imports db/" boundary now lives in
 * `.oxlintrc.json` (no-restricted-imports), so it is not retested here.
 *
 * SPEC: D52-L, I26-L
 */

import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const sourceRoot = join(repositoryRoot, 'src');

function readSource(relativePath: string): string {
  return readFileSync(join(sourceRoot, relativePath), 'utf8');
}

function sourceFiles(subtree = ''): string[] {
  return globSync('**/*.ts', { cwd: join(sourceRoot, subtree) })
    .map((file) => (subtree ? `${subtree}/${file}` : file))
    .sort();
}

describe('I26-L architectural boundary', () => {
  it('graph schema kinds is a zero-import taxonomy leaf', () => {
    const kindsSource = readSource('graph/schema/kinds.ts');

    expect(kindsSource).not.toMatch(/^import\s/mu);
  });

  it('db imports from graph only through graph/schema/kinds.ts', () => {
    const graphImport = /from ['"]\.\.\/graph\//u;
    const graphImportingFiles = sourceFiles('db').filter((file) => graphImport.test(readSource(file)));
    const forbiddenImports = graphImportingFiles.filter((file) => file !== 'db/schema.ts');
    const schemaImports = readSource('db/schema.ts')
      .split('\n')
      .filter((line) => graphImport.test(line));

    expect(forbiddenImports).toEqual([]);
    expect(schemaImports).toEqual([expect.stringContaining('../graph/schema/kinds.js')]);
  });

  it('db/schema.ts does not own domain enum const arrays', () => {
    const enumConst =
      /export const (INTENT_KINDS|ORACLE_KINDS|DESIGN_KINDS|PLAN_KINDS|NODE_PLANES|NODE_BASES|EDGE_CATEGORIES|EDGE_STANCES|READINESS_BANDS|LENS_AFFINITIES|GAP_DISPOSITIONS|GAP_PREDICATE_KINDS)/u;

    expect(readSource('db/schema.ts')).not.toMatch(enumConst);
  });

  it('spec writes live only in CommandExecutor', () => {
    const specWrite = /\.(insert|update|delete)\(schema\.specs\)|\.(insert|update|delete)\(specs\)/u;
    const writingFiles = sourceFiles().filter(
      (file) => !file.includes('.test.') && specWrite.test(readSource(file)),
    );

    expect(writingFiles).toEqual(['graph/command-executor.ts']);
  });
});
