// FE-800 cleanup: single-owner module for the spec-scoped plan layout
// (`<dir>/.brunch/cook/specs/<id>/plan.yaml`). Pins layout, latest-by-mtime
// selection, and spec-id parsing — all of which the writer (plan-runner)
// and resolver (cook-cli) previously rebuilt independently.

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseSpecId, resolveLatestSpecPlanPath, specPlanPath } from './spec-plan-paths.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function makeTmpDir(prefix = 'spec-plan-paths-'): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

describe('specPlanPath', () => {
  it('joins .brunch/cook/specs/<id>/plan.yaml under dir', () => {
    expect(specPlanPath('/x', 23)).toBe(join('/x', '.brunch', 'cook', 'specs', '23', 'plan.yaml'));
    expect(specPlanPath('/x', 1)).toBe(join('/x', '.brunch', 'cook', 'specs', '1', 'plan.yaml'));
  });
});

describe('resolveLatestSpecPlanPath', () => {
  it('returns undefined when the specs root is absent', () => {
    const d = makeTmpDir();
    expect(resolveLatestSpecPlanPath(d)).toBeUndefined();
  });

  it('returns undefined when the specs root is empty', () => {
    const d = makeTmpDir();
    mkdirSync(join(d, '.brunch', 'cook', 'specs'), { recursive: true });
    expect(resolveLatestSpecPlanPath(d)).toBeUndefined();
  });

  it('returns the only spec plan when exactly one exists', () => {
    const d = makeTmpDir();
    const specDir = join(d, '.brunch', 'cook', 'specs', '7');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'plan.yaml'), 'epics: []\nslices: []\n');

    expect(resolveLatestSpecPlanPath(d)).toBe(join(specDir, 'plan.yaml'));
  });

  it('picks the newest plan by mtime when several exist', () => {
    const d = makeTmpDir();
    const older = join(d, '.brunch', 'cook', 'specs', '1');
    const newer = join(d, '.brunch', 'cook', 'specs', '2');
    mkdirSync(older, { recursive: true });
    mkdirSync(newer, { recursive: true });
    writeFileSync(join(older, 'plan.yaml'), 'epics: []\nslices: []\n');
    writeFileSync(join(newer, 'plan.yaml'), 'epics: []\nslices: []\n');

    // Force mtime ordering deterministically: older = 60s ago.
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(older, 'plan.yaml'), past, past);

    expect(resolveLatestSpecPlanPath(d)).toBe(join(newer, 'plan.yaml'));
  });

  it('breaks equal-mtime ties by highest spec id', () => {
    const d = makeTmpDir();
    const lower = join(d, '.brunch', 'cook', 'specs', '11');
    const higher = join(d, '.brunch', 'cook', 'specs', '12');
    mkdirSync(lower, { recursive: true });
    mkdirSync(higher, { recursive: true });
    writeFileSync(join(lower, 'plan.yaml'), 'epics: []\nslices: []\n');
    writeFileSync(join(higher, 'plan.yaml'), 'epics: []\nslices: []\n');

    const sameTime = new Date('2026-06-01T00:00:00.000Z');
    utimesSync(join(lower, 'plan.yaml'), sameTime, sameTime);
    utimesSync(join(higher, 'plan.yaml'), sameTime, sameTime);

    expect(resolveLatestSpecPlanPath(d)).toBe(join(higher, 'plan.yaml'));
  });

  it('ignores spec subdirs whose names are not positive integers', () => {
    const d = makeTmpDir();
    const valid = join(d, '.brunch', 'cook', 'specs', '5');
    const bogus = join(d, '.brunch', 'cook', 'specs', 'scratch');
    const zero = join(d, '.brunch', 'cook', 'specs', '0');
    mkdirSync(valid, { recursive: true });
    mkdirSync(bogus, { recursive: true });
    mkdirSync(zero, { recursive: true });
    writeFileSync(join(valid, 'plan.yaml'), 'x: 1\n');
    writeFileSync(join(bogus, 'plan.yaml'), 'x: 1\n');
    writeFileSync(join(zero, 'plan.yaml'), 'x: 1\n');

    expect(resolveLatestSpecPlanPath(d)).toBe(join(valid, 'plan.yaml'));
  });

  it('skips spec subdirs that have no plan.yaml inside them', () => {
    const d = makeTmpDir();
    const empty = join(d, '.brunch', 'cook', 'specs', '3');
    const populated = join(d, '.brunch', 'cook', 'specs', '4');
    mkdirSync(empty, { recursive: true });
    mkdirSync(populated, { recursive: true });
    writeFileSync(join(populated, 'plan.yaml'), 'x: 1\n');

    expect(resolveLatestSpecPlanPath(d)).toBe(join(populated, 'plan.yaml'));
  });
});

describe('parseSpecId', () => {
  it('accepts positive integers and returns the number', () => {
    expect(parseSpecId('1', '--spec')).toBe(1);
    expect(parseSpecId('42', '--spec')).toBe(42);
  });

  it('rejects zero, negatives, non-numerics, and fractional values', () => {
    expect(() => parseSpecId('0', '--spec')).toThrow(/--spec/);
    expect(() => parseSpecId('-3', '--spec')).toThrow(/--spec/);
    expect(() => parseSpecId('abc', '--spec')).toThrow(/--spec/);
    expect(() => parseSpecId('1.5', '--spec')).toThrow(/--spec/);
    expect(() => parseSpecId('', '--spec')).toThrow(/--spec/);
  });

  it('includes the caller-provided flag label in the error message', () => {
    expect(() => parseSpecId('abc', 'spec id')).toThrow(/spec id/);
    expect(() => parseSpecId('abc', '<specId>')).toThrow(/<specId>/);
  });
});
