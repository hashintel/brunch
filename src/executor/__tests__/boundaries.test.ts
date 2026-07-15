import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Executable form of the src/executor/TOPOLOGY.md boundary rule:
 * `executor/ x> db/, .pi/, app/, rpc/, web/` — product core keeps no storage,
 * adapter, transport, or UI imports; those layers import executor, never the
 * reverse.
 */

const ROOT = process.cwd();
const EXECUTOR_ROOT = 'src/executor';
const FORBIDDEN_SEGMENTS = ['/rpc/', '/web/', '/app/', '/db/', '/.pi/'];

function sourceFilesUnder(path: string): string[] {
  const full = join(ROOT, path);
  const files: string[] = [];
  for (const entry of readdirSync(full)) {
    const absolute = join(full, entry);
    const relativePath = relative(ROOT, absolute);
    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFilesUnder(relativePath));
    } else if (entry.endsWith('.ts')) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(join(ROOT, file), 'utf8');
  return [...source.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

describe('executor core purity', () => {
  it('imports no adapter, transport, storage, or UI layer', () => {
    const violations: string[] = [];
    for (const file of sourceFilesUnder(EXECUTOR_ROOT)) {
      const directory = file.slice(0, file.lastIndexOf('/'));
      for (const specifier of importSpecifiers(file)) {
        const resolved = `/${join(directory, specifier)}`;
        if (FORBIDDEN_SEGMENTS.some((segment) => resolved.includes(segment))) {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps the parallel batch subtree private to its public root', () => {
    const violations: string[] = [];
    for (const file of sourceFilesUnder('src')) {
      if (file === 'src/executor/parallel-slice-batch.ts') continue;
      if (file.startsWith('src/executor/parallel-slice-batch/')) continue;
      const directory = file.slice(0, file.lastIndexOf('/'));
      for (const specifier of importSpecifiers(file)) {
        const resolved = `/${join(directory, specifier)}`;
        if (resolved.includes('/executor/parallel-slice-batch/')) {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
