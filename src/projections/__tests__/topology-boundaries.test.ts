import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCE_ROOT = 'src';
const PROJECTIONS_ROOT = 'src/projections';
const ADAPTER_IMPORT_SEGMENTS = ['/.pi/', '/rpc/', '/app/', '/web/'];
const PROJECTION_ADAPTER_EXCEPTIONS: Record<string, true> = {
  'src/exchanges/projections/__tests__/present-candidates.test.ts': true,
  'src/exchanges/projections/present-candidates.ts': true,
  'src/exchanges/projections/present-question.ts': true,
  'src/exchanges/projections/present-review-set.ts': true,
  'src/exchanges/projections/request-response.ts': true,
};

function sourceFilesUnder(path: string): string[] {
  const full = join(ROOT, path);
  const entries = readdirSync(full);
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(full, entry);
    const relativePath = relative(ROOT, absolute);
    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFilesUnder(relativePath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function importedSourcePaths(file: string): string[] {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const directory = file.slice(0, file.lastIndexOf('/'));
  const imports = [...source.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
  return imports
    .map((specifier) => join(directory, specifier.replace(/\.js$/, '.ts')))
    .map((path) => relative(ROOT, join(ROOT, path)).replaceAll('\\', '/'))
    .filter((path) => path.startsWith(SOURCE_ROOT));
}

function sourceImportersOf(target: string): string[] {
  return sourceFilesUnder(SOURCE_ROOT).filter((file) => importedSourcePaths(file).includes(target));
}

// Layer-wide import boundaries (workspace/) are enforced statically
// in `.oxlintrc.json` via no-restricted-imports. The tests below cover the
// projection-specific invariants that lint cannot express: the `.pi` schema
// carve-out for exchanges, and the two seam guards (neighborhood has no
// importers; session runtime-state does not pull reusable runtime projections).
describe('projection topology boundaries', () => {
  it('keeps reusable projections out of adapter and transport layers', () => {
    const offenders = sourceFilesUnder(PROJECTIONS_ROOT).flatMap((file) => {
      if (PROJECTION_ADAPTER_EXCEPTIONS[file]) return [];
      const imports = importedSourcePaths(file).filter((path) =>
        ADAPTER_IMPORT_SEGMENTS.some((segment) => `/${path}`.includes(segment)),
      );
      return imports.map((path) => `${file} -> ${path}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps graph neighborhood as a direct graph read instead of a projection layer', () => {
    expect(sourceImportersOf('src/projections/graph/neighborhood.ts')).toEqual([]);
  });

  it('keeps runtime vocab in a pure session schema leaf', () => {
    expect(importedSourcePaths('src/session/schema/kinds.ts')).toEqual([]);
    expect(importedSourcePaths('src/session/runtime-state.ts')).toContain('src/session/schema/kinds.ts');

    const schemaSource = readFileSync(join(ROOT, 'src/session/schema/kinds.ts'), 'utf8');
    expect(schemaSource).not.toContain('READINESS_GRADES');
    expect(schemaSource).not.toMatch(/AgentGoal|GOAL/i);

    const runtimeStateSource = readFileSync(join(ROOT, 'src/session/runtime-state.ts'), 'utf8');
    expect(runtimeStateSource).not.toMatch(/export const OPERATIONAL_MODE_IDS\s*=\s*\[/);
    expect(runtimeStateSource).not.toMatch(/export const AGENT_STRATEGY_IDS\s*=\s*\[/);
    expect(runtimeStateSource).not.toMatch(/export const AGENT_LENS_IDS\s*=\s*\[/);
  });

  it('keeps runtime-state transcript facts from importing reusable runtime projections', () => {
    expect(importedSourcePaths('src/session/runtime-state.ts')).not.toContain(
      'src/projections/session/runtime-state.ts',
    );
  });

  it('keeps suspended runtime policy out of session projection ownership', () => {
    const sessionProjectionFiles = sourceFilesUnder('src/projections/session').filter(
      (file) => !file.includes('/__tests__/') && !file.endsWith('.test.ts'),
    );
    expect(sessionProjectionFiles).not.toContain('src/projections/session/affordances.ts');
    expect(sessionProjectionFiles).not.toContain('src/projections/session/capability-readiness.ts');

    const suspendedRuntimeImporters = sessionProjectionFiles.filter((file) =>
      importedSourcePaths(file).some((path) => path.includes('/_suspended/')),
    );
    expect(suspendedRuntimeImporters).toEqual([]);
  });
});
