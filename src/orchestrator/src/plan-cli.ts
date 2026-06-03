// FE-800 slice 4: `brunch plan` CLI surface.
//
// Reads a `CompletedSpecSnapshot` from a JSON file, threads it through
// the FE-800 emitter (projection → planning → reconciliation), writes
// the resulting plan to `<outDir>/.brunch/cook/plan.yaml`, and prints
// every reconciliation warning on stderr. Mirrors the convention from
// `cook-cli.ts` for argument parsing and banner output.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// `yaml` is already a runtime dep used by `loadPlan` / cook-plan-projection tests.
import { stringify as stringifyYaml } from 'yaml';

import { emitCookPlanFromSnapshot } from './cook-plan-emitter.js';
import type { RunModel } from './cook-plan-llm-planning.js';
import type { CompletedSpecSnapshot } from './cook-plan-projection.js';
import type { ReconciliationWarning } from './cook-plan-reconciliation.js';

export type PlanOptions = {
  snapshotPath: string;
  outDir: string;
  verbose: boolean;
};

export function parsePlanArgs(args: string[]): PlanOptions {
  let snapshotPath = '';
  let outDir = process.cwd();
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith('--out=')) {
      outDir = resolve(arg.slice('--out='.length));
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      snapshotPath = resolve(arg);
    }
  }

  if (!snapshotPath) {
    throw new Error('Usage: brunch plan <snapshot.json> [--out=<dir>] [--verbose]');
  }

  return { snapshotPath, outDir, verbose };
}

export type RunPlanArgs = PlanOptions & {
  /** Injectable LLM seam. Defaults to the production anthropic adapter via the emitter. */
  runModel?: RunModel;
  /** Injectable stderr writer. Defaults to `console.error`. */
  log?: (line: string) => void;
};

export async function runPlan(args: RunPlanArgs): Promise<void> {
  const log = args.log ?? ((line: string) => console.error(line));

  const snapshot = JSON.parse(readFileSync(args.snapshotPath, 'utf8')) as CompletedSpecSnapshot;

  log('');
  log('  brunch plan');
  log('  ──────────────────────────────────────');
  log(`  snapshot   ${args.snapshotPath}`);
  log(`  out        ${args.outDir}`);
  log('');

  const emitOptions = args.runModel ? { runModel: args.runModel } : {};
  const result = await emitCookPlanFromSnapshot(snapshot, emitOptions);

  const planPath = join(args.outDir, '.brunch', 'cook', 'plan.yaml');
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, stringifyYaml(result.plan));

  log(`  ✓  plan      ${planPath}`);
  log(`     ${result.plan.epics.length} epics, ${result.plan.slices.length} slices`);
  log('');

  if (result.planningResult.status === 'failed') {
    log(`  !  planning failed — ${result.planningResult.reason}`);
    log(`  !  emitted a plan with no inferred ordering (reconciliation against empty enrichment)`);
    log('');
  }

  if (result.warnings.length > 0) {
    log(`  ${result.warnings.length} reconciliation warnings:`);
    for (const warning of result.warnings) {
      log(`  !  ${formatWarning(warning)}`);
    }
    log('');
  }
}

function formatWarning(warning: ReconciliationWarning): string {
  switch (warning.code) {
    case 'synthesized-verification-target':
      return `synthesized-verification-target  ${warning.sliceId} → ${warning.target}`;
    case 'dropped-dependency-nonexistent-id':
      return `dropped-dependency-nonexistent-id  ${warning.sliceId} → ${warning.missingId}`;
    case 'dropped-self-loop':
      return `dropped-self-loop  ${warning.sliceId}`;
    case 'cycle-break-dropped-edge':
      return `cycle-break-dropped-edge  ${warning.sliceId} → ${warning.droppedDependsOn}`;
    case 'dropped-dependency-on-non-buildable':
      return `dropped-dependency-on-non-buildable  ${warning.sliceId} → ${warning.nonBuildableId}`;
    case 'dropped-non-buildable-slice':
      return `dropped-non-buildable-slice  ${warning.sliceId}`;
    case 'dropped-empty-epic':
      return `dropped-empty-epic  ${warning.epicId} (${warning.epicSummary})`;
    case 'orphan-slice-assigned-to-default-epic':
      return `orphan-slice-assigned-to-default-epic  ${warning.sliceId}`;
  }
}
