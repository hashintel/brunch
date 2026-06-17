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

import type { ArchitectDraft, RunModel } from '../orchestrator/src/plan-architect.js';
import type { CompletedSpecSnapshot } from '../orchestrator/src/plan-projection.js';
import { CookBus } from '../orchestrator/src/presenter/bus.js';
import { PlainPresenter } from '../orchestrator/src/presenter/plain.js';
import type { Plan } from '../orchestrator/src/types.js';
import { parsePlanArgs, runPlan } from './plan-runner.js';

/** A bus wired to a capturing PlainPresenter — the golden stderr stream. */
function captureBus(): { bus: CookBus; lines: string[] } {
  const lines: string[] = [];
  const bus = new CookBus();
  bus.subscribe(new PlainPresenter({ log: (line) => lines.push(line) }));
  return { bus, lines };
}

describe('parsePlanArgs', () => {
  it('parses <specId>, --out=<dir>, --verbose', () => {
    const opts = parsePlanArgs(['2', '--out=/tmp/x', '--verbose']);

    expect(opts.specificationId).toBe(2);
    expect(opts.outDir.endsWith('/tmp/x') || opts.outDir.endsWith('\\tmp\\x')).toBe(true);
    expect(opts.verbose).toBe(true);
  });

  it('defaults outDir to current working directory and verbose to false', () => {
    const opts = parsePlanArgs(['2']);

    expect(opts.outDir).toBe(process.cwd());
    expect(opts.verbose).toBe(false);
  });

  it('defaults outDir to the caller-provided launch directory', () => {
    const launchDir = join(tmpdir(), 'brunch-plan-launch-dir');

    const opts = parsePlanArgs(['2'], launchDir);

    expect(opts.outDir).toBe(launchDir);
  });

  it('lets --out override the caller-provided launch directory', () => {
    const launchDir = join(tmpdir(), 'brunch-plan-launch-dir');
    const explicitOut = join(tmpdir(), 'brunch-plan-explicit-out');

    const opts = parsePlanArgs(['2', `--out=${explicitOut}`], launchDir);

    expect(opts.outDir).toBe(explicitOut);
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
  });

  it('rejects unknown flags instead of silently swallowing them', () => {
    expect(() => parsePlanArgs(['2', '--bogus'])).toThrow(/--bogus/);
    expect(() => parsePlanArgs(['2', '--out'])).toThrow(/--out/);
    // `-1` looks like a flag, not a positional — caught by the unknown-flag arm.
    expect(() => parsePlanArgs(['-1'])).toThrow(/-1/);
  });

  it('rejects a second positional argument instead of overwriting the first', () => {
    expect(() => parsePlanArgs(['2', '3'])).toThrow(/positional|"3"/);
  });

  it('parses --profile=<id> into a validated profile', () => {
    expect(parsePlanArgs(['2', '--profile=node-vitest']).profile).toBe('node-vitest');
    expect(parsePlanArgs(['2']).profile).toBeUndefined();
  });

  it('rejects an unknown --profile value, listing valid ids', () => {
    expect(() => parsePlanArgs(['2', '--profile=rust'])).toThrow(/rust.*bun.*node-vitest/s);
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

    // Authored 2-cycle a ↔ b (covering both reqs): materialization drops one
    // incoming edge and the multi-slice epic gets its synthesized seam.
    const draft: ArchitectDraft = {
      epics: [{ id: 'core', summary: 'Core' }],
      slices: [
        {
          id: 'a',
          epic_id: 'core',
          definition: 'A',
          depends_on: ['b'],
          writes: ['src/a.ts'],
          derivedFrom: ['req-10'],
        },
        {
          id: 'b',
          epic_id: 'core',
          definition: 'B',
          depends_on: ['a'],
          writes: ['src/b.ts'],
          derivedFrom: ['req-11'],
        },
      ],
      nonBuildableRequirementIds: [],
    };
    const runModel: RunModel = async () => draft;

    return { snapshot, dir, runModel };
  }

  it('writes .brunch/cook/plan.yaml and hides synthesis events at default verbosity', async () => {
    const { snapshot, dir, runModel } = makeRunWithCycle();
    const { bus, lines: stderrLines } = captureBus();

    await runPlan({
      specificationId: 2,
      snapshot,
      outDir: dir,
      verbose: false,
      runModel,
      bus,
    });

    const planPath = join(dir, '.brunch', 'cook', 'specs', '2', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.slices.map((slice) => slice.id)).toEqual(['a', 'b']);

    // Transformation warning (cycle break) is always printed.
    expect(stderrLines.some((line) => line.includes('cycle-break-dropped-edge'))).toBe(true);
    // …as the terse code line only — no plain-English account at default verbosity.
    expect(stderrLines.some((line) => line.includes('to break a dependency cycle'))).toBe(false);
    // Synthesis warning is suppressed at default verbosity.
    expect(stderrLines.some((line) => line.includes('synthesized-verification-target'))).toBe(false);
    // Header echoes the spec id.
    expect(stderrLines.some((line) => line.includes('spec') && line.includes('2'))).toBe(true);
  });

  it('passes the profile override through to the emitted plan', async () => {
    const { snapshot, dir, runModel } = makeRunWithCycle();

    await runPlan({
      specificationId: 2,
      snapshot,
      outDir: dir,
      verbose: false,
      profile: 'node-vitest',
      runModel,
      bus: new CookBus(),
    });

    const planPath = join(dir, '.brunch', 'cook', 'specs', '2', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.profile).toBe('node-vitest');
  });

  it('shows synthesis events when --verbose is set', async () => {
    const { snapshot, dir, runModel } = makeRunWithCycle();
    const { bus, lines: stderrLines } = captureBus();

    await runPlan({
      specificationId: 2,
      snapshot,
      outDir: dir,
      verbose: true,
      runModel,
      bus,
    });

    expect(stderrLines.some((line) => line.includes('cycle-break-dropped-edge'))).toBe(true);
    const synth = stderrLines.filter((line) => line.includes('synthesized-verification-target'));
    expect(synth.length).toBe(2);
    // Verbose mode appends a plain-English account after the terse code line.
    expect(synth.every((line) => line.includes('a default test target was synthesized'))).toBe(true);
    expect(stderrLines.some((line) => line.includes('to break a dependency cycle'))).toBe(true);
  });

  it('surfaces the architect fallback as a stderr warning line when the LLM throws', async () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [{ id: 10, content: 'Only req', kindOrdinal: 1 }],
      criteria: [],
      edges: [],
    };
    const dir = mkdtempSync(join(tmpdir(), 'plan-runner-fail-'));

    const runModel: RunModel = async () => {
      throw new Error('llm-boom');
    };
    const { bus, lines: stderrLines } = captureBus();

    await runPlan({
      specificationId: 2,
      snapshot,
      outDir: dir,
      verbose: false,
      runModel,
      bus,
    });

    const planPath = join(dir, '.brunch', 'cook', 'specs', '2', 'plan.yaml');
    const reloaded = parseYaml(readFileSync(planPath, 'utf8')) as Plan;
    expect(reloaded.slices.map((slice) => slice.id)).toEqual(['req-10']);

    expect(
      stderrLines.some(
        (line) => line.startsWith('  !  ') && line.includes('architect-failed-fallback-to-projection'),
      ),
    ).toBe(true);
    expect(stderrLines.some((line) => line.includes('llm-boom'))).toBe(true);
  });
});
