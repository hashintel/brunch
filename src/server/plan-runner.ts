// FE-800 slice 6: server-side `brunch plan <specId>` driver.
//
// Replaces the orchestrator-side `plan-cli.ts` (snapshot JSON file path).
// Lives in `src/server/` because it needs DB access to resolve the
// `<specId>` argument into a `CompletedSpecSnapshot`. The orchestrator
// package remains pure: this file imports the emitter + warning
// helpers but the reverse never happens.
//
// Display rules unchanged from slice 5: failure + transformation
// warnings always printed; synthesis warnings only with `--verbose`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

import {
  emitPlanFromSnapshot,
  emitterWarningCategory,
  formatEmitterWarning,
  type EmitterWarning,
} from '../orchestrator/src/plan-emitter.js';
import type { RunModel } from '../orchestrator/src/plan-llm-planning.js';
import type { CompletedSpecSnapshot } from '../orchestrator/src/plan-projection.js';

export type PlanOptions = {
  specificationId: number;
  outDir: string;
  verbose: boolean;
};

const USAGE = 'Usage: brunch plan <specId> [--out=<dir>] [--verbose]';

export function parsePlanArgs(args: string[]): PlanOptions {
  let specIdRaw: string | undefined;
  let outDir = process.cwd();
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith('--out=')) {
      outDir = resolve(arg.slice('--out='.length));
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag "${arg}". ${USAGE}`);
    } else if (specIdRaw === undefined) {
      specIdRaw = arg;
    } else {
      throw new Error(`Unexpected positional argument "${arg}". ${USAGE}`);
    }
  }

  if (specIdRaw === undefined) {
    throw new Error(`Missing spec id. ${USAGE}`);
  }

  const specificationId = Number(specIdRaw);
  if (!Number.isInteger(specificationId) || specificationId <= 0) {
    throw new Error(`Invalid spec id "${specIdRaw}" — expected a positive integer.`);
  }

  return { specificationId, outDir, verbose };
}

export type RunPlanArgs = {
  specificationId: number;
  snapshot: CompletedSpecSnapshot;
  outDir: string;
  verbose: boolean;
  /** Injectable LLM seam. Defaults to the production anthropic adapter via the emitter. */
  runModel?: RunModel;
  /** Injectable stderr writer. Defaults to `console.error`. */
  log?: (line: string) => void;
};

export async function runPlan(args: RunPlanArgs): Promise<void> {
  const log = args.log ?? ((line: string) => console.error(line));

  log('');
  log('  brunch plan');
  log('  ──────────────────────────────────────');
  log(`  spec       ${args.specificationId}`);
  log(`  out        ${args.outDir}`);
  log('');

  const emitOptions = args.runModel ? { runModel: args.runModel } : {};
  const result = await emitPlanFromSnapshot(args.snapshot, emitOptions);

  // Spec-scoped output path. Each spec gets its own subdir so multiple
  // specs can live side-by-side on the same project / branch. `brunch
  // cook` resolves either by `--spec=<id>` or by auto-picking the most
  // recently emitted plan; the legacy `<dir>/.brunch/cook/plan.yaml`
  // path stays in cook's resolver as the authored-single-plan fallback
  // (this command never writes there).
  const planPath = join(args.outDir, '.brunch', 'cook', 'specs', String(args.specificationId), 'plan.yaml');
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, stringifyYaml(result.plan));

  log(`  ✓  plan      ${planPath}`);
  log(`     ${result.plan.epics.length} epics, ${result.plan.slices.length} slices`);
  log('');

  // Audit-weight display: failure + transformation always; synthesis
  // only when --verbose. The header counts only what we print so the
  // number on screen matches the lines below it.
  const printed = result.warnings.filter((warning) => shouldPrint(warning, args.verbose));
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
