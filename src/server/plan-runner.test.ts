// FE-800 slice 6: `parsePlanArgs` + `runPlan` against an in-memory
// `CompletedSpecSnapshot`. Ports the slice-4/5 plan-cli test shapes
// (cycle-break transformation always printed, synthesis hidden by
// default, planning-failed in the audit stream) to the new spec-id
// surface — the snapshot is supplied directly so these tests stay
// pure of DB seeding (covered separately in
// `db/completed-spec-snapshot.test.ts`).

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import type { PlanningEnrichment, RunModel } from '../orchestrator/src/plan-llm-planning.js';
import type { CompletedSpecSnapshot } from '../orchestrator/src/plan-projection.js';
import type { Plan } from '../orchestrator/src/types.js';
import { parsePlanArgs, runPlan } from './plan-runner.js';

describe('parsePlanArgs', () => {
  it('parses <specId>, --out=<dir>, --verbose', () => {
    const opts = parsePlanArgs(['2', '--out=/tmp/x', '--verbose']);

    expect(opts.specId).toBe(2);
    expect(opts.outDir.endsWith('/tmp/x') || opts.outDir.endsWith('\\tmp\\x')).toBe(true);
    expect(opts.verbose).toBe(true);
  });

  it('defaults outDir to current working directory and verbose to false', () => {
    const opts = parsePlanArgs(['2']);

    expect(opts.outDir).toBe(process.cwd());
    expect(opts.verbose).toBe(false);
  });

  it('supports short -v alias for verbose', () => {
    const opts = parsePlanArgs(['2', '-v']);
    expect(opts.verbose).toBe(true);
  });

  it('throws a usage error mentioning spec id when the argument is missing', () => {
    expect(() => parsePlanArgs([])).toThrow(/spec id|specId/i);
    expect(() => parsePlanArgs(['--out=/tmp/x'])).toThrow(/spec id|specId/i);
  });

  it('rejects non-numeric and non-positive spec ids', () => {
    expect(() => parsePlanArgs(['abc'])).toThrow(/spec id/i);
    expect(() => parsePlanArgs(['0'])).toThrow(/spec id/i);
    expect(() => parsePlanArgs(['-1'])).toThrow(/spec id|specId/i);
  });
});

describe('runPlan', () => {
  function makeRunWithCycle() {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 10, content: 'A', kindOrdinal: 1 },
        { id: 11, content: 'B', kindOrdinal: 2 },
      ],
      criteria: [],
      edges: [],
    };
    const dir = mkdtempSync(join(tmpdir(), 'plan-runner-'));

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

    return { snapshot, dir, runModel };
  }

  it('writes .brunch/cook/plan.yaml and hides synthesis events at default verbosity', async () => {
    const { snapshot, dir, runModel } = makeRunWithCycle();
    const stderrLines: string[] = [];

    await runPlan({
      specId: 2,
      snapshot,
      outDir: dir,
      verbose: false,
      runModel,
      log: (line) => stderrLines.push(line),
    });

    const planPath = join(dir, '.brunch', 'cook', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.slices.map((slice) => slice.id)).toEqual(['req-1', 'req-2']);

    // Transformation warning (cycle break) is always printed.
    expect(stderrLines.some((line) => line.includes('cycle-break-dropped-edge'))).toBe(true);
    // Synthesis warning is suppressed at default verbosity.
    expect(stderrLines.some((line) => line.includes('synthesized-verification-target'))).toBe(false);
    // Header echoes the spec id.
    expect(stderrLines.some((line) => line.includes('spec') && line.includes('2'))).toBe(true);
  });

  it('shows synthesis events when --verbose is set', async () => {
    const { snapshot, dir, runModel } = makeRunWithCycle();
    const stderrLines: string[] = [];

    await runPlan({
      specId: 2,
      snapshot,
      outDir: dir,
      verbose: true,
      runModel,
      log: (line) => stderrLines.push(line),
    });

    expect(stderrLines.some((line) => line.includes('cycle-break-dropped-edge'))).toBe(true);
    const synth = stderrLines.filter((line) => line.includes('synthesized-verification-target'));
    expect(synth.length).toBe(2);
  });

  it('surfaces planning-failed as a stderr warning line when the LLM throws', async () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [{ id: 10, content: 'Only req', kindOrdinal: 1 }],
      criteria: [],
      edges: [],
    };
    const dir = mkdtempSync(join(tmpdir(), 'plan-runner-fail-'));

    const runModel: RunModel = async () => {
      throw new Error('llm-boom');
    };
    const stderrLines: string[] = [];

    await runPlan({
      specId: 2,
      snapshot,
      outDir: dir,
      verbose: false,
      runModel,
      log: (line) => stderrLines.push(line),
    });

    const planPath = join(dir, '.brunch', 'cook', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.slices.map((slice) => slice.id)).toEqual(['req-1']);

    expect(stderrLines.some((line) => line.startsWith('  !  ') && line.includes('planning-failed'))).toBe(
      true,
    );
    expect(stderrLines.some((line) => line.includes('llm-boom'))).toBe(true);
  });
});
