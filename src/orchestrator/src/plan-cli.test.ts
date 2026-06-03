import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import type { PlanningEnrichment, RunModel } from './cook-plan-llm-planning.js';
import type { CompletedSpecSnapshot } from './cook-plan-projection.js';
import { parsePlanArgs, runPlan } from './plan-cli.js';
import type { Plan } from './types.js';

describe('parsePlanArgs', () => {
  it('parses <snapshot.json>, --out=<dir>, --verbose', () => {
    const opts = parsePlanArgs(['snapshot.json', '--out=/tmp/x', '--verbose']);

    expect(opts.snapshotPath.endsWith('snapshot.json')).toBe(true);
    expect(opts.outDir.endsWith('/tmp/x') || opts.outDir.endsWith('\\tmp\\x')).toBe(true);
    expect(opts.verbose).toBe(true);
  });

  it('defaults outDir to current working directory and verbose to false', () => {
    const opts = parsePlanArgs(['snapshot.json']);

    expect(opts.outDir).toBe(process.cwd());
    expect(opts.verbose).toBe(false);
  });

  it('supports short -v alias for verbose', () => {
    const opts = parsePlanArgs(['snapshot.json', '-v']);
    expect(opts.verbose).toBe(true);
  });

  it('throws a usage error when the snapshot path is missing', () => {
    expect(() => parsePlanArgs([])).toThrow(/snapshot/i);
    expect(() => parsePlanArgs(['--out=/tmp/x'])).toThrow(/snapshot/i);
  });
});

describe('runPlan', () => {
  it('writes .brunch/cook/plan.yaml from the snapshot and surfaces warnings on stderr', async () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 10, content: 'First requirement', kindOrdinal: 1 },
        { id: 11, content: 'Second requirement', kindOrdinal: 2 },
      ],
      criteria: [],
      edges: [],
    };
    const dir = mkdtempSync(join(tmpdir(), 'plan-cli-'));
    const snapshotPath = join(dir, 'snapshot.json');
    writeFileSync(snapshotPath, JSON.stringify(snapshot));

    const enrichment: PlanningEnrichment = {
      sliceDependencies: [],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-1', 'req-2'] }],
      nonBuildableSliceIds: [],
    };
    const runModel: RunModel = async () => enrichment;

    const stderrLines: string[] = [];

    await runPlan({
      snapshotPath,
      outDir: dir,
      verbose: false,
      runModel,
      log: (line) => stderrLines.push(line),
    });

    const planPath = join(dir, '.brunch', 'cook', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.slices.map((s) => s.id)).toEqual(['req-1', 'req-2']);
    expect(reloaded.epics.map((e) => e.id)).toEqual(['core']);

    // Warnings printed with the convention prefix.
    expect(stderrLines.some((line) => line.startsWith('  !  '))).toBe(true);
    // Synthesized verification warnings exist (one per slice).
    const synth = stderrLines.filter((line) => line.includes('synthesized-verification-target'));
    expect(synth.length).toBe(2);
  });

  it('emits a usable plan and a failure note when the LLM throws', async () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [{ id: 10, content: 'Only req', kindOrdinal: 1 }],
      criteria: [],
      edges: [],
    };
    const dir = mkdtempSync(join(tmpdir(), 'plan-cli-fail-'));
    const snapshotPath = join(dir, 'snapshot.json');
    writeFileSync(snapshotPath, JSON.stringify(snapshot));

    const runModel: RunModel = async () => {
      throw new Error('llm-boom');
    };
    const stderrLines: string[] = [];

    await runPlan({
      snapshotPath,
      outDir: dir,
      verbose: false,
      runModel,
      log: (line) => stderrLines.push(line),
    });

    const planPath = join(dir, '.brunch', 'cook', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.slices.map((s) => s.id)).toEqual(['req-1']);
    expect(stderrLines.some((line) => line.toLowerCase().includes('planning failed'))).toBe(true);
    expect(stderrLines.some((line) => line.includes('llm-boom'))).toBe(true);
  });
});
