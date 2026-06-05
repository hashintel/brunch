import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const STRUCTURED_EXCHANGE_EXTENSION = 'src/.pi/extensions/structured-exchange';
const STRUCTURED_EXCHANGE_PROJECT = 'src/structured-exchange/project';
const STRUCTURED_EXCHANGE_SCHEMAS = 'src/.pi/extensions/structured-exchange/schemas';
const ACTIVE_PROJECTORS = new Set([
  'src/structured-exchange/project/present-options.ts',
  'src/structured-exchange/project/present-question.ts',
  'src/structured-exchange/project/present-review-set.ts',
  'src/structured-exchange/project/request-answer.ts',
  'src/structured-exchange/project/request-choice.ts',
  'src/structured-exchange/project/request-choices.ts',
  'src/structured-exchange/project/request-review.ts',
]);
const ALLOWED_TYPEBOX_FILES = new Set(['src/.pi/extensions/structured-exchange/pi-schema.ts']);

function sourceFilesUnder(path: string): string[] {
  const full = join(ROOT, path);
  const entries = readdirSync(full);
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = join(full, entry);
    const stat = statSync(candidate);
    if (stat.isDirectory()) {
      files.push(...sourceFilesUnder(relative(ROOT, candidate)));
    } else if (candidate.endsWith('.ts') && !candidate.endsWith('.test.ts')) {
      files.push(relative(ROOT, candidate));
    }
  }
  return files.sort();
}

function readSource(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('structured-exchange source boundaries', () => {
  it('keeps TypeBox authoring out of active structured-exchange tools', () => {
    const offenders = sourceFilesUnder(STRUCTURED_EXCHANGE_EXTENSION).filter((file) => {
      if (file.startsWith(STRUCTURED_EXCHANGE_SCHEMAS) || ALLOWED_TYPEBOX_FILES.has(file)) return false;
      const source = readSource(file);
      return source.includes("from 'typebox'") || source.includes('from "typebox"');
    });

    expect(offenders).toEqual([]);
  });

  it('keeps tool result details construction inside canonical projectors', () => {
    const offenders = sourceFilesUnder(STRUCTURED_EXCHANGE_EXTENSION).filter((file) => {
      if (file.startsWith(STRUCTURED_EXCHANGE_SCHEMAS)) return false;
      const source = readSource(file);
      return (
        source.includes('tool_meta:') ||
        source.includes('schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA') ||
        source.includes('schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA') ||
        source.includes('schema: STRUCTURED_EXCHANGE_CAPTURE_DETAILS_SCHEMA')
      );
    });

    expect(offenders).toEqual([]);
  });

  it('validates active present/request details at the projector boundary', () => {
    const offenders = sourceFilesUnder(STRUCTURED_EXCHANGE_PROJECT).filter((file) => {
      if (!ACTIVE_PROJECTORS.has(file)) return false;
      const source = readSource(file);
      return !source.includes('.parse(');
    });

    expect(offenders).toEqual([]);
  });

  it('keeps structured-exchange TypeBox usage quarantined to the Pi schema adapter', () => {
    const offenders = [
      ...sourceFilesUnder(STRUCTURED_EXCHANGE_EXTENSION),
      ...sourceFilesUnder('src/session'),
    ].filter((file) => {
      if (ALLOWED_TYPEBOX_FILES.has(file)) return false;
      const source = readSource(file);
      return source.includes("from 'typebox'") || source.includes('from "typebox"');
    });

    expect(offenders).toEqual([]);
  });

  it('keeps tool_meta atoms single-sourced in schemas/shared.ts', () => {
    const offenders = sourceFilesUnder(STRUCTURED_EXCHANGE_SCHEMAS).filter((file) => {
      if (file.endsWith('/shared.ts')) return false;
      const source = readSource(file);
      return source.includes('curr: z.literal(') || source.includes('prev: z.literal(');
    });

    expect(offenders).toEqual([]);
  });
});
