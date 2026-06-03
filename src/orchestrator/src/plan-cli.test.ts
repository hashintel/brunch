import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { parsePlanArgs, runPlan } from './plan-cli.js';
import type { PlanningEnrichment, RunModel } from './plan-llm-planning.js';
import type { CompletedSpecSnapshot } from './plan-projection.js';
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
  // Snapshot whose reconciliation will produce a real transformation
  // warning (cycle break) so we can assert it's always shown.
  function makeRunWithCycle() {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 10, content: 'A', kindOrdinal: 1 },
        { id: 11, content: 'B', kindOrdinal: 2 },
      ],
      criteria: [],
      edges: [],
    };
    const dir = mkdtempSync(join(tmpdir(), 'plan-cli-'));
    const snapshotPath = join(dir, 'snapshot.json');
    writeFileSync(snapshotPath, JSON.stringify(snapshot));

    // 2-cycle req-1 ↔ req-2: reconciliation drops req-1's incoming edge.
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [
        { sliceId: 'req-1', dependsOn: ['req-2'] },
        { sliceId: 'req-2', dependsOn: ['req-1'] },
      ],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-1', 'req-2'] }],
      nonBuildableSliceIds: [],
    };
    const runModel: RunModel = async () => enrichment;

    return { snapshot, snapshotPath, dir, runModel };
  }

  it('writes .brunch/cook/plan.yaml and hides synthesis events at default verbosity', async () => {
    const { snapshotPath, dir, runModel } = makeRunWithCycle();
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

    // Transformation warning (cycle break) is always printed.
    expect(stderrLines.some((line) => line.includes('cycle-break-dropped-edge'))).toBe(true);
    // Synthesis warning is suppressed at default verbosity.
    expect(stderrLines.some((line) => line.includes('synthesized-verification-target'))).toBe(false);
  });

  it('shows synthesis events when --verbose is set', async () => {
    const { snapshotPath, dir, runModel } = makeRunWithCycle();
    const stderrLines: string[] = [];

    await runPlan({
      snapshotPath,
      outDir: dir,
      verbose: true,
      runModel,
      log: (line) => stderrLines.push(line),
    });

    // Transformation still printed.
    expect(stderrLines.some((line) => line.includes('cycle-break-dropped-edge'))).toBe(true);
    // Synthesis now visible — one line per slice.
    const synth = stderrLines.filter((line) => line.includes('synthesized-verification-target'));
    expect(synth.length).toBe(2);
  });

  it('surfaces planning-failed as a stderr warning line when the LLM throws', async () => {
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

    // Single audit stream: planning-failed appears as a `!`-prefixed warning,
    // carrying the original error message.
    expect(stderrLines.some((line) => line.startsWith('  !  ') && line.includes('planning-failed'))).toBe(
      true,
    );
    expect(stderrLines.some((line) => line.includes('llm-boom'))).toBe(true);
  });
});
