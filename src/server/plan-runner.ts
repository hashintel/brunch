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
import { dirname, resolve } from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

import type { RunModel } from '../orchestrator/src/plan-architect.js';
import {
  emitPlanFromSnapshot,
  emitterWarningCategory,
  explainEmitterWarning,
  formatEmitterWarning,
  type EmitterWarning,
} from '../orchestrator/src/plan-emitter.js';
import type { CompletedSpecSnapshot } from '../orchestrator/src/plan-projection.js';
import type { CookBus } from '../orchestrator/src/presenter/bus.js';
import { parseProfileId, type ProfileId } from '../orchestrator/src/project-profile.js';
import { parseSpecId, specPlanPath } from '../orchestrator/src/spec-plan-paths.js';

export type PlanOptions = {
  specificationId: number;
  outDir: string;
  verbose: boolean;
  /** Toolchain profile override; wins over the spec's profile. */
  profile?: ProfileId;
};

const USAGE = 'Usage: brunch plan <specId> [--out=<dir>] [--profile=<id>] [--verbose]';

export function parsePlanArgs(args: string[], defaultOutDir: string = process.cwd()): PlanOptions {
  let specIdRaw: string | undefined;
  let outDir = resolve(defaultOutDir);
  let verbose = false;
  let profile: ProfileId | undefined;

  for (const arg of args) {
    if (arg.startsWith('--out=')) {
      outDir = resolve(arg.slice('--out='.length));
    } else if (arg.startsWith('--profile=')) {
      profile = parseProfileId(arg.slice('--profile='.length));
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

  const specificationId = parseSpecId(specIdRaw, 'spec id');

  return { specificationId, outDir, verbose, profile };
}

export type RunPlanArgs = {
  specificationId: number;
  snapshot: CompletedSpecSnapshot;
  outDir: string;
  verbose: boolean;
  /** Toolchain profile override (`--profile`); wins over the spec's profile. */
  profile?: ProfileId;
  /**
   * Project directory the toolchain is detected from for brownfield plans
   * (`brunch-detect`). The CLI passes the launch cwd; greenfield ignores it.
   */
  repoDir?: string;
  /** Injectable LLM seam. Defaults to the production anthropic adapter via the emitter. */
  runModel?: RunModel;
  /** Presentation boundary. The orchestrator emits CookEvents; a presenter renders them. */
  bus: CookBus;
};

export async function runPlan(args: RunPlanArgs): Promise<void> {
  const { bus } = args;

  // Spec-scoped output path. Each spec gets its own subdir so multiple
  // specs can live side-by-side on the same project / branch. `brunch
  // cook` resolves either by `--spec=<id>` or by auto-picking the most
  // recently emitted plan; the legacy `<dir>/.brunch/cook/plan.yaml`
  // path stays in cook's resolver as the authored-single-plan fallback
  // (this command never writes there). Layout owned by spec-plan-paths.
  const planPath = specPlanPath(args.outDir, args.specificationId);

  // Show the spec plan dir (e.g. .brunch/cook/specs/49), not the launch
  // root — that's the exact place this run writes plan.yaml.
  bus.emit({ kind: 'plan-start', specId: args.specificationId, outDir: dirname(planPath) });

  const result = await emitPlanFromSnapshot(args.snapshot, {
    ...(args.runModel ? { runModel: args.runModel } : {}),
    ...(args.profile ? { profile: args.profile } : {}),
    ...(args.repoDir ? { repoDir: args.repoDir } : {}),
  });

  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, stringifyYaml(result.plan));

  bus.emit({
    kind: 'plan-written',
    path: planPath,
    epics: result.plan.epics.length,
    slices: result.plan.slices.length,
  });

  // Audit-weight display: failure + transformation always; synthesis
  // only when --verbose. The header counts only what we print so the
  // number on screen matches the lines below it. In verbose mode each
  // line also carries a plain-English account of why it fired.
  const printed = result.warnings.filter((warning) => shouldPrint(warning, args.verbose));
  bus.emit({
    kind: 'plan-warnings',
    messages: printed.map((warning) =>
      args.verbose
        ? `${formatEmitterWarning(warning)} — ${explainEmitterWarning(warning)}`
        : formatEmitterWarning(warning),
    ),
  });
}

function shouldPrint(warning: EmitterWarning, verbose: boolean): boolean {
  const category = emitterWarningCategory(warning);
  if (category === 'synthesis') return verbose;
  return true;
}
