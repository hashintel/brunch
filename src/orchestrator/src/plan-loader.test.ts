import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadPlan } from './plan-loader.js';

describe('loadPlan', () => {
  it('parses a valid plan.yaml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cook-plan-'));
    const yamlPath = join(dir, 'plan.yaml');
    writeFileSync(
      yamlPath,
      `
epics:
  - id: e1
    summary: "First"
    depends_on: []
    verification: []
slices:
  - id: s1
    epic_id: e1
    definition: "Do something"
    depends_on: []
    verification:
      - kind: unit-test
        target: "tests/s1.test.ts"
`,
    );

    const plan = loadPlan(yamlPath);
    expect(plan.epics).toHaveLength(1);
    expect(plan.epics[0]!.id).toBe('e1');
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]!.epic_id).toBe('e1');
    expect(plan.slices[0]!.verification).toEqual([{ kind: 'unit-test', target: 'tests/s1.test.ts' }]);
  });

  it('defaults a plan with no mode field to greenfield', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cook-plan-'));
    const yamlPath = join(dir, 'plan.yaml');
    writeFileSync(yamlPath, 'epics: []\nslices: []\n');

    expect(loadPlan(yamlPath).mode).toBe('greenfield');
  });

  it('preserves an explicit brownfield mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cook-plan-'));
    const yamlPath = join(dir, 'plan.yaml');
    writeFileSync(yamlPath, 'mode: brownfield\nepics: []\nslices: []\n');

    expect(loadPlan(yamlPath).mode).toBe('brownfield');
  });

  it('throws on missing file', () => {
    expect(() => loadPlan('/tmp/nonexistent-plan.yaml')).toThrow();
  });

  it('throws on invalid structure (no epics)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cook-plan-'));
    const yamlPath = join(dir, 'bad.yaml');
    writeFileSync(yamlPath, 'foo: bar\n');

    expect(() => loadPlan(yamlPath)).toThrow('missing or non-array');
  });
});
