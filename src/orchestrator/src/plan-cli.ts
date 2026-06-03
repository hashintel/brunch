// FE-800 slice 4: `brunch plan` CLI surface.
// FE-800 slice 5: severity-aware warning display (failure +
// transformation always; synthesis only with --verbose).
//
// Reads a `CompletedSpecSnapshot` from a JSON file, threads it through
// the FE-800 emitter (projection → planning → reconciliation), writes
// the resulting plan to `<outDir>/.brunch/cook/plan.yaml`, and prints
// every emitter warning on stderr partitioned by audit weight.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

import {
  emitPlanFromSnapshot,
  emitterWarningCategory,
  formatEmitterWarning,
  type EmitterWarning,
} from './plan-emitter.js';
import type { RunModel } from './plan-llm-planning.js';
import type { CompletedSpecSnapshot } from './plan-projection.js';

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
  const result = await emitPlanFromSnapshot(snapshot, emitOptions);

  const planPath = join(args.outDir, '.brunch', 'cook', 'plan.yaml');
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, stringifyYaml(result.plan));

  log(`  ✓  plan      ${planPath}`);
  log(`     ${result.plan.epics.length} epics, ${result.plan.slices.length} slices`);
  log('');

  // Audit-weight display: failure + transformation always; synthesis
  // only when --verbose. The header counts only what we print so the
  // number on screen matches the lines below it.
  const printed = result.warnings.filter((w) => shouldPrint(w, args.verbose));
  if (printed.length > 0) {
    log(`  ${printed.length} warnings:`);
    for (const warning of printed) {
      log(`  !  ${formatEmitterWarning(warning)}`);
    }
    log('');
  }
}

function shouldPrint(warning: EmitterWarning, verbose: boolean): boolean {
  const category = emitterWarningCategory(warning);
  if (category === 'synthesis') return verbose;
  return true;
}
