import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCE_ROOT = 'src';
const PROJECTIONS_ROOT = 'src/projections';
const RENDERERS_ROOT = 'src/renderers';
const ADAPTER_IMPORT_SEGMENTS = ['/.pi/', '/rpc/', '/app/', '/web/'];
const PROJECTION_ADAPTER_EXCEPTIONS: Record<string, true> = {
  'src/projections/exchanges/present-options.ts': true,
  'src/projections/exchanges/present-question.ts': true,
  'src/projections/exchanges/present-review-set.ts': true,
  'src/projections/exchanges/request-answer.ts': true,
  'src/projections/exchanges/request-choice.ts': true,
  'src/projections/exchanges/request-choices.ts': true,
  'src/projections/exchanges/request-review.ts': true,
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

describe('projection and renderer topology boundaries', () => {
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

  it('keeps reusable renderers out of adapter and transport layers', () => {
    const offenders = sourceFilesUnder(RENDERERS_ROOT).flatMap((file) => {
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

  it('keeps runtime-state transcript facts from importing reusable runtime projections', () => {
    expect(importedSourcePaths('src/session/runtime-state.ts')).not.toContain(
      'src/projections/session/runtime-state.ts',
    );
    expect(importedSourcePaths('src/session/runtime-state.ts')).not.toContain(
      'src/projections/session/runtime-policy.ts',
    );
  });
});
