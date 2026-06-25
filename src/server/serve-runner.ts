// `brunch serve <specId>` — the Arc-1 capstone: one shot from a completed spec
// to a promoted cook result, no manual steps. It is pure glue over the existing
// `brunch plan` and `brunch cook` paths: emit the plan, then cook it. The only
// real logic here is arg parsing + the flag→stage mapping (serve's `--out` is
// the *promote* target → cook; `--profile` stamps the plan), so those are the
// testable units; the db/snapshot wiring stays in `cli.ts`.

import { resolve } from 'node:path';

import type { CookOptions } from '../orchestrator/src/cook-cli.js';
import { parseProfileId, type ProfileId } from '../orchestrator/src/project-profile.js';

export type ServeOptions = {
  specificationId: number;
  /** Greenfield promote target (→ cook `--out`); brownfield promotes automatically. */
  outDir?: string;
  /** Merge the promoted brownfield `cook/<runId>` branch into the active branch as the final step. */
  land: boolean;
  force: boolean;
  /** Toolchain profile override; stamped into the emitted plan. */
  profile?: ProfileId;
  verbose: boolean;
  // Petrinaut + execution flags, forwarded to cook.
  petrinautStream: boolean;
  petrinautUrl?: string;
  petrinautLanes: 'both' | 'mechanical';
  petrinautFold: 'color' | 'identity';
  petrinautOpen: boolean;
  policy: 'serial' | 'parallel';
  maxRetries: number;
};

const USAGE =
  'Usage: brunch serve <specId> [--out=<dir>] [--land] [--force] [--profile=<id>] [--policy=serial|parallel] [--max-retries=<n>] [--petrinaut-stream] [--petrinaut-url=<url>] [--petrinaut-lanes=both|mechanical] [--petrinaut-fold=color|identity] [--no-petrinaut-open] [--verbose]';

export function parseServeArgs(args: string[]): ServeOptions {
  let specIdRaw: string | undefined;
  let outDir: string | undefined;
  let land = false;
  let force = false;
  let profile: ProfileId | undefined;
  let verbose = false;
  let petrinautStream = false;
  let petrinautUrl: string | undefined;
  let petrinautLanes: 'both' | 'mechanical' = 'both';
  let petrinautFold: 'color' | 'identity' = 'identity';
  let petrinautOpen = true;
  let policy: 'serial' | 'parallel' = 'serial';
  let maxRetries = 3;
  let sawPetrinautUrl = false;
  let sawNoPetrinautOpen = false;

  for (const arg of args) {
    if (arg.startsWith('--out=')) {
      outDir = arg.slice('--out='.length);
    } else if (arg === '--land') {
      land = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--profile=')) {
      profile = parseProfileId(arg.slice('--profile='.length));
    } else if (arg.startsWith('--policy=')) {
      const val = arg.slice('--policy='.length);
      if (val !== 'serial' && val !== 'parallel')
        throw new Error(`Unknown policy: ${val}. Use serial or parallel.`);
      policy = val;
    } else if (arg.startsWith('--max-retries=')) {
      const parsed = Number.parseInt(arg.slice('--max-retries='.length), 10);
      if (!Number.isFinite(parsed) || parsed < 0)
        throw new Error(`Invalid --max-retries value. Must be a non-negative integer.`);
      maxRetries = parsed;
    } else if (arg === '--petrinaut-stream') {
      petrinautStream = true;
    } else if (arg.startsWith('--petrinaut-url=')) {
      petrinautUrl = arg.slice('--petrinaut-url='.length);
      sawPetrinautUrl = true;
    } else if (arg.startsWith('--petrinaut-lanes=')) {
      const val = arg.slice('--petrinaut-lanes='.length);
      if (val !== 'both' && val !== 'mechanical')
        throw new Error(`Unknown --petrinaut-lanes value: ${val}. Use both or mechanical.`);
      petrinautLanes = val;
    } else if (arg.startsWith('--petrinaut-fold=')) {
      const val = arg.slice('--petrinaut-fold='.length);
      if (val !== 'color' && val !== 'identity')
        throw new Error(`Unknown --petrinaut-fold value: ${val}. Use color or identity.`);
      petrinautFold = val;
    } else if (arg === '--no-petrinaut-open') {
      petrinautOpen = false;
      sawNoPetrinautOpen = true;
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

  if (specIdRaw === undefined) throw new Error(`Missing <specId>. ${USAGE}`);
  const specificationId = Number.parseInt(specIdRaw, 10);
  if (!Number.isInteger(specificationId) || specificationId <= 0) {
    throw new Error(`Invalid <specId> "${specIdRaw}": expected a positive integer. ${USAGE}`);
  }
  if (land && outDir !== undefined) {
    // --out is the greenfield promote target (a separate dir); --land merges the
    // brownfield result into this repo's active branch. They name different modes.
    throw new Error('--land cannot be combined with --out (--out is the greenfield promote target).');
  }
  if (sawPetrinautUrl && !petrinautStream) {
    throw new Error('--petrinaut-url requires --petrinaut-stream');
  }
  if (sawNoPetrinautOpen && !petrinautStream) {
    throw new Error('--no-petrinaut-open requires --petrinaut-stream');
  }

  return {
    specificationId,
    outDir,
    land,
    force,
    profile,
    verbose,
    petrinautStream,
    petrinautUrl,
    petrinautLanes,
    petrinautFold,
    petrinautOpen,
    policy,
    maxRetries,
  };
}

/**
 * Map serve options to the cook stage. `specId` is set so cook reads the plan
 * just emitted (not an auto-picked older one); serve's `--out` becomes cook's
 * greenfield promote target (brownfield promotes automatically regardless).
 *
 * `cookDir` is the resolved Brunch project root where plan state was written.
 * `sourceDir` is the brownfield repo/workspace target. They are usually the
 * same, but differ when the UI was launched from a child below a parent
 * `.brunch/` project root.
 */
export function serveCookOptions(
  opts: ServeOptions,
  cookDir: string,
  sourceDir: string = cookDir,
): CookOptions {
  return {
    dir: cookDir,
    sourceDir,
    policy: opts.policy,
    maxRetries: opts.maxRetries,
    verbose: opts.verbose,
    petrinautFold: opts.petrinautFold,
    petrinautLanes: opts.petrinautLanes,
    petrinautStream: opts.petrinautStream,
    ...(opts.petrinautUrl ? { petrinautUrl: opts.petrinautUrl } : {}),
    petrinautOpen: opts.petrinautOpen,
    ...(opts.outDir ? { outDir: resolve(cookDir, opts.outDir) } : {}),
    landBranch: opts.land,
    force: opts.force,
    confine: 'on',
    specId: opts.specificationId,
  };
}

/**
 * Sequence the two stages: emit the plan, then cook it. Cook only runs if
 * planning succeeded — a failed plan short-circuits with nothing cooked. Both
 * stages are injected so the db/snapshot/agent side effects stay in `cli.ts`
 * and this orchestration is unit-testable. `cookDir` is the resolved launch cwd
 * the plan was written under, threaded into the cook options.
 */
export async function runServe(
  opts: ServeOptions,
  cookDir: string,
  deps: { plan: () => Promise<void>; cook: (cookOpts: CookOptions) => Promise<void>; sourceDir?: string },
): Promise<void> {
  await deps.plan();
  await deps.cook(serveCookOptions(opts, cookDir, deps.sourceDir ?? cookDir));
}
