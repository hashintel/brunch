import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { type CookFinishLand, cookBannerLines, cookFinishLines, cookSummaryLines } from './cook-report.js';
import { createOrchestrator } from './engine.js';
import {
  epicIdsForEpicVerifyMerge,
  type MergeConflict,
  mergeCompletedSlicesIntoTree,
  mergeSourceDirsIntoTree,
} from './epic-sandbox-merge.js';
import { FileReportSink } from './file-report-sink.js';
import { loadLocalEnvFile } from './local-env.js';
import type { FiringPolicy } from './petri-net.js';
import { composeLauncherUrl, resolvePetrinautUrl } from './petrinaut-launcher-url.js';
import { createPetrinautStreamBus, type PetrinautStreamBus } from './petrinaut-stream-bus.js';
import { createPetrinautStreamServer, type PetrinautStreamServer } from './petrinaut-stream-server.js';
import { createPiActions } from './pi-actions.js';
import { loadPlan } from './plan-loader.js';
import type { CookBus } from './presenter.js';
import { resolveToolchain } from './project-profile.js';
import { landCookBranch, promoteGreenfieldRun } from './promote-run.js';
import { harvestCookRun, selectSalvageableSlices } from './run-artifact.js';
import { brunchRef, gcCookRun } from './run-refs.js';
import { type ConfineMode, createSandboxGuard, runConfinementPreflight } from './sandbox-guard.js';
import { parseSpecId, resolveLatestSpecPlanPath, specPlanPath, specsRootDir } from './spec-plan-paths.js';
import { ToolchainTestRunner } from './test-runner.js';
import type { Plan, PlanMode } from './types.js';
import { createSandbox } from './worktree.js';

/**
 * Which `NetFolding` constructor the cook run uses for Petrinaut export
 * (`net.json`, SDCPN file, live event stream). `identity` (default) keeps
 * the unfolded per-slice net so the demo / small-N visualization shows the
 * full per-slice lifecycle; `color` collapses N structurally-identical slice
 * subnets into one and carries slice identity on the token color.
 */
export type PetrinautFoldMode = 'color' | 'identity';
export type PetrinautLanesMode = 'both' | 'mechanical';

export type CookOptions = {
  dir: string;
  policy: FiringPolicy;
  maxRetries: number;
  verbose: boolean;
  petrinautFold: PetrinautFoldMode;
  /** Lane projection for Petrinaut export/stream; `mechanical` hides the semantic lane. */
  petrinautLanes: PetrinautLanesMode;
  /** When true, runCook boots the ephemeral SSE server and composes the launcher URL. */
  petrinautStream: boolean;
  /** Optional CLI override for the Petrinaut route URL (full path included). */
  petrinautUrl?: string;
  /** Whether to auto-launch the system browser; CI=true also suppresses at runtime. */
  petrinautOpen: boolean;
  /** Target dir to promote a completed greenfield run into (opt-in). Omitted → no promotion. */
  outDir?: string;
  /** Allow promoting into a non-empty target (otherwise refused). */
  force: boolean;
  /** OS-level agent confinement: `on` (default, fail-closed) or `off` (escape hatch). */
  confine: ConfineMode;
  /**
   * Brownfield only: after promotion, merge `brunch/run/<runId>` into the repo's active
   * branch as the final step. Set by `serve --land`; plain `cook` never sets it,
   * keeping promotion's hands-off default intact unless the user opts in.
   */
  landBranch?: boolean;
  /**
   * Explicit specification id whose emitted plan (under
   * `<dir>/.brunch/cook/specs/<id>/plan.yaml`) should be cooked.
   * When omitted, `resolveCookPlan` auto-picks the most recently
   * emitted spec plan (or falls back to legacy paths).
   */
  specId?: number;
};

export function parseCookArgs(args: string[]): CookOptions {
  let dir = '';
  let policy: FiringPolicy = 'serial';
  let maxRetries = 3;
  let verbose = false;
  let petrinautFold: PetrinautFoldMode = 'identity';
  let petrinautLanes: PetrinautLanesMode = 'both';
  let petrinautStream = false;
  let petrinautUrl: string | undefined;
  let petrinautOpen = true;
  let specId: number | undefined;
  let outDir: string | undefined;
  let force = false;
  let confine: ConfineMode = 'on';
  let sawNoOpen = false;
  let sawUrl = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--spec=')) {
      specId = parseSpecId(arg.split('=').slice(1).join('='), '--spec');
    } else if (arg.startsWith('--policy=')) {
      const val = arg.split('=')[1]!;
      if (val !== 'serial' && val !== 'parallel') {
        throw new Error(`Unknown policy: ${val}. Use serial or parallel.`);
      }
      policy = val;
    } else if (arg.startsWith('--max-retries=')) {
      const parsed = Number.parseInt(arg.split('=')[1]!, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid --max-retries value: ${arg.split('=')[1]}. Must be a non-negative integer.`);
      }
      maxRetries = parsed;
    } else if (arg.startsWith('--petrinaut-fold=')) {
      const val = arg.split('=')[1]!;
      if (val !== 'color' && val !== 'identity') {
        throw new Error(`Unknown --petrinaut-fold value: ${val}. Use color or identity.`);
      }
      petrinautFold = val;
    } else if (arg.startsWith('--petrinaut-lanes=')) {
      const val = arg.split('=')[1]!;
      if (val !== 'both' && val !== 'mechanical') {
        throw new Error(`Unknown --petrinaut-lanes value: ${val}. Use both or mechanical.`);
      }
      petrinautLanes = val;
    } else if (arg === '--petrinaut-stream') {
      petrinautStream = true;
    } else if (arg.startsWith('--petrinaut-url=')) {
      petrinautUrl = arg.split('=').slice(1).join('=');
      sawUrl = true;
    } else if (arg === '--no-petrinaut-open') {
      petrinautOpen = false;
      sawNoOpen = true;
    } else if (arg.startsWith('--out=')) {
      // Resolved against the launch cwd below — not the CLI child's cwd, which
      // via `bin/brunch` is the package root rather than the user's project.
      outDir = arg.slice('--out='.length);
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--confine=')) {
      const val = arg.split('=')[1]!;
      if (val !== 'on' && val !== 'off') {
        throw new Error(`Unknown --confine value: ${val}. Use on or off.`);
      }
      confine = val;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      dir = arg;
    } else {
      // Reject unknown flags instead of silently ignoring them (e.g. --spec-id
      // is not a flag; the spec selector is --spec=<id>).
      throw new Error(`Unknown flag "${arg}". Run "brunch --help" for cook usage.`);
    }
  }

  // The directory is optional: with no positional argument, cook runs against
  // the launch cwd (where it looks for `.brunch/`). `BRUNCH_LAUNCH_CWD` mirrors
  // the launchCwd `runCook` uses, so the resolved dir matches the run root.
  // Relative `dir`/`--out` resolve against this launch cwd too, not the CLI
  // child's cwd (the package root via `bin/brunch`).
  const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();
  if (!dir) {
    dir = launchCwd;
  }

  // Companion-flag validation: stream-only flags require --petrinaut-stream.
  if (sawUrl && !petrinautStream) {
    throw new Error('--petrinaut-url requires --petrinaut-stream');
  }
  if (sawNoOpen && !petrinautStream) {
    throw new Error('--no-petrinaut-open requires --petrinaut-stream');
  }

  return {
    dir: resolve(launchCwd, dir),
    policy,
    maxRetries,
    verbose,
    petrinautFold,
    petrinautLanes,
    petrinautStream,
    petrinautUrl,
    petrinautOpen,
    force,
    confine,
    ...(outDir !== undefined ? { outDir: resolve(launchCwd, outDir) } : {}),
    ...(specId !== undefined ? { specId } : {}),
  };
}

/**
 * Resolve the SSE server's bind port from `PORT`. A set, valid value pins the
 * port (so the launcher URL / Petrinaut consumer can target a stable endpoint);
 * unset/blank leaves it dynamic (kernel-chosen ephemeral). Invalid values throw
 * loudly rather than silently falling back to a random port.
 *
 * Note: `PORT` is also the brunch backend's fallback port var
 * (`resolveBackendPort` in `src/server/runtime-config.ts`). Setting it pins
 * both; if you run the dev/backend server on the same `PORT`, the stream
 * server will fail to bind. Prefer a dedicated value when they must differ.
 */
export function resolvePetrinautStreamPort(env: { PORT?: string }): number | undefined {
  const raw = env.PORT?.trim();
  if (!raw) return undefined;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid PORT value: ${env.PORT}`);
  }
  return port;
}

export function recordCookExitStatus(ok: boolean): void {
  process.exitCode = ok ? 0 : 1;
}

/**
 * Default browser-open seam — small wrapper around the `open` npm package
 * so tests (and `runCook` callers that want a no-op) can inject their own.
 */
export async function defaultOpenUrl(url: string): Promise<void> {
  const { default: open } = await import('open');
  await open(url);
}

export type CreatePetrinautStreamSetupOpts = {
  petrinautUrl: string;
  /** Suppress auto-open when false (matches `--no-petrinaut-open` / CI). URL still prints. */
  shouldOpen: boolean;
  openUrl: (url: string) => void | Promise<void>;
  /** Where the composed URL gets printed. Defaults to `console.error` so it shows on the cook banner stream. */
  log?: (line: string) => void;
  /**
   * Fixed bind port for the SSE server. `undefined` (the default) leaves the
   * port dynamic — the kernel picks an ephemeral one per run. Resolved from
   * `PORT` by `resolvePetrinautStreamPort`.
   */
  port?: number;
  /** Server factory — exposed for tests. Defaults to the real HTTP server. */
  createServer?: (bus: PetrinautStreamBus) => PetrinautStreamServer;
};

export type PetrinautStreamSetupHandle = {
  /** Pass directly to `OrchestratorInput.setupPetrinautStream`. */
  setupHook: NonNullable<Parameters<ReturnType<typeof createOrchestrator>['run']>[0]['setupPetrinautStream']>;
  /** Tear the server down — call from `runCook`'s `finally`. Idempotent. */
  stop: () => Promise<void>;
};

/**
 * Build the live-stream setup hook + server-stop handle. Pure factory —
 * caller provides every side-effecting collaborator. The hook itself:
 *   1. constructs the bus from the engine-supplied `sdcpnFile`
 *   2. constructs the SSE server over the bus
 *   3. awaits `server.start()` so it is listening before returning
 *   4. composes the launcher URL and prints it
 *   5. invokes `openUrl(url)` unless `shouldOpen === false`; open failure
 *      logs a warning and continues
 *   6. returns `bus.publish` as the engine's onEvent fan-out
 */
export function createPetrinautStreamSetup(opts: CreatePetrinautStreamSetupOpts): PetrinautStreamSetupHandle {
  const log = opts.log ?? ((line: string) => console.error(line));
  const createServer =
    opts.createServer ??
    ((bus: PetrinautStreamBus) =>
      createPetrinautStreamServer({ bus, ...(opts.port !== undefined ? { port: opts.port } : {}) }));

  let server: PetrinautStreamServer | undefined;

  const setupHook: PetrinautStreamSetupHandle['setupHook'] = async ({ runId, sdcpnFile }) => {
    const bus = createPetrinautStreamBus({ runId, sdcpnFile });
    server = createServer(bus);
    const endpoint = await server.start();
    const launcherUrl = composeLauncherUrl({
      petrinautUrl: opts.petrinautUrl,
      runId,
      streamUrl: endpoint.streamUrl,
    });
    log('');
    log(`  Petrinaut live stream`);
    log(`  ──────────────────────────────────────`);
    log(`  stream     ${endpoint.streamUrl}`);
    log(`  launcher   ${launcherUrl}`);
    log('');
    if (opts.shouldOpen) {
      try {
        await opts.openUrl(launcherUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  !  Couldn't auto-open browser (${msg}); visit ${launcherUrl}`);
      }
    }
    return (event) => bus.publish(event);
  };

  return {
    setupHook,
    stop: async () => {
      if (!server) return;
      await server.stop();
    },
  };
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

export type ResolvedCookPlan =
  | { kind: 'resolved'; planPath: string; sourceDir: string }
  | { kind: 'error'; message: string };

/**
 * Resolve WHERE cook's plan lives, in precedence order:
 *
 *   1. `<dir>/plan.yaml` exists                                  → authored fixture plan.
 *   2. Explicit `specId`:
 *        `<dir>/.brunch/cook/specs/<id>/plan.yaml` exists        → that plan.
 *        missing                                                 → error.
 *   3. No `specId`, any `<dir>/.brunch/cook/specs/<n>/plan.yaml` → newest by mtime.
 *   4. Legacy `<dir>/.brunch/cook/plan.yaml`                     → that plan.
 *   5. None of the above                                         → error.
 *
 * Greenfield vs brownfield is NOT decided here: it is spec-derived plan
 * truth, read from the loaded plan's `mode` by `resolveSandboxPlan`. No git
 * gate runs here — the clean-tree requirement is brownfield-only.
 *
 * Pure function — no process exits, no side effects beyond filesystem reads.
 */
export function resolveCookPlan(dir: string, specId?: number): ResolvedCookPlan {
  const fixturePath = join(dir, 'plan.yaml');
  if (existsSync(fixturePath)) {
    return { kind: 'resolved', planPath: fixturePath, sourceDir: dir };
  }

  const legacyPath = join(dir, '.brunch', 'cook', 'plan.yaml');

  let planPath: string | undefined;
  if (specId !== undefined) {
    const explicit = specPlanPath(dir, specId);
    if (!existsSync(explicit)) {
      return { kind: 'error', message: `No plan emitted for spec ${specId}: ${explicit}` };
    }
    planPath = explicit;
  } else {
    planPath = resolveLatestSpecPlanPath(dir) ?? (existsSync(legacyPath) ? legacyPath : undefined);
  }

  if (planPath) {
    return { kind: 'resolved', planPath, sourceDir: dir };
  }

  return {
    kind: 'error',
    message: `No plan found at ${fixturePath}, ${specsRootDir(dir)}/<id>/plan.yaml, or ${legacyPath}`,
  };
}

export type ResolvedSandbox =
  | { kind: 'fixture' }
  | { kind: 'codebase'; sourceDir: string }
  | { kind: 'error'; message: string };

/**
 * Decide the worktree strategy from the plan's spec-derived `mode`:
 *
 *   - greenfield → empty (fixture) worktree, generate from scratch; no git gate.
 *   - brownfield → clone the cwd repo (codebase); requires `dir` to be a git
 *     repo with a clean working tree (untracked files ignored).
 *
 * Pure modulo the brownfield git read; no process exits.
 */
export function resolveSandboxPlan(planMode: PlanMode, dir: string): ResolvedSandbox {
  if (planMode !== 'brownfield') {
    return { kind: 'fixture' };
  }
  const gitCheck = isCleanGitWorkingTree(dir);
  if (gitCheck.kind === 'not-git') {
    return { kind: 'error', message: `Brownfield cook requires <dir> to be a git repo: ${dir}` };
  }
  if (gitCheck.kind === 'dirty') {
    return {
      kind: 'error',
      message: `Brownfield cook refuses to run against an uncommitted working tree:\n${gitCheck.status}`,
    };
  }
  return { kind: 'codebase', sourceDir: dir };
}

/**
 * The tree to promote after a completed greenfield run. The shared layout
 * promotes the run sandbox directly; the per-slice (parallel) layout merges all
 * completed slices into one whole-plan tree (declaration-order-wins, collisions
 * reported) under `<runDir>/__promote__`.
 */
export function promotionSourceDir(opts: {
  sliceLayout: 'shared' | 'per-slice';
  sandboxDir: string;
  runDir: string;
  plan: Plan;
  completedSliceIds: string[];
  verifiedEpicSandboxes?: readonly VerifiedEpicSandbox[];
}): { dir: string; conflicts: MergeConflict[] } {
  if (opts.sliceLayout === 'shared') return { dir: opts.sandboxDir, conflicts: [] };
  const completed = new Set(opts.completedSliceIds);
  const ordered = opts.plan.slices.map((s) => s.id).filter((id) => completed.has(id));
  const verified = maximalVerifiedEpicSandboxes(opts.plan, opts.verifiedEpicSandboxes ?? []);
  if (verified.length > 0) {
    const coveredEpics = new Set<string>();
    for (const sandbox of verified) {
      for (const epicId of epicIdsForEpicVerifyMerge(opts.plan, sandbox.epicId)) coveredEpics.add(epicId);
    }
    const fallbackSlices = opts.plan.slices
      .filter((slice) => completed.has(slice.id) && !coveredEpics.has(slice.epic_id))
      .map((slice) => ({ id: slice.id, dir: join(opts.sandboxDir, slice.id) }));
    const verifiedSources = verified.map((sandbox) => ({
      id: `__epic__/${sandbox.epicId}`,
      dir: sandbox.dir,
    }));
    const merge = mergeSourceDirsIntoTree({
      sources: [...fallbackSlices, ...verifiedSources],
      destDir: join(opts.runDir, '__promote__'),
    });
    return { dir: merge.mergeDir, conflicts: merge.conflicts };
  }
  const merge = mergeCompletedSlicesIntoTree({
    parentSandboxDir: opts.sandboxDir,
    sliceIds: ordered,
    destDir: join(opts.runDir, '__promote__'),
  });
  return { dir: merge.mergeDir, conflicts: merge.conflicts };
}

export type VerifiedEpicSandbox = {
  epicId: string;
  dir: string;
};

function maximalVerifiedEpicSandboxes(
  plan: Plan,
  verifiedEpicSandboxes: readonly VerifiedEpicSandbox[],
): VerifiedEpicSandbox[] {
  const byEpic = new Map(verifiedEpicSandboxes.map((sandbox) => [sandbox.epicId, sandbox]));
  const verifiedEpicIds = new Set(byEpic.keys());
  return plan.epics
    .map((epic) => byEpic.get(epic.id))
    .filter((sandbox): sandbox is VerifiedEpicSandbox => {
      if (!sandbox) return false;
      return ![...verifiedEpicIds].some(
        (otherEpicId) =>
          otherEpicId !== sandbox.epicId &&
          epicIdsForEpicVerifyMerge(plan, otherEpicId).includes(sandbox.epicId),
      );
    });
}

function verifiedEpicSandboxesFromReports(reports: FileReportSink): VerifiedEpicSandbox[] {
  return reports.getAll().flatMap((line) => {
    if (line.event !== 'epic-sandbox-merged') return [];
    const { epicSandboxDir } = line.payload;
    if (typeof epicSandboxDir !== 'string') return [];
    return [{ epicId: line.epicId, dir: epicSandboxDir }];
  });
}

type GitWorkingTreeCheck = { kind: 'clean' } | { kind: 'dirty'; status: string } | { kind: 'not-git' };

function isCleanGitWorkingTree(dir: string): GitWorkingTreeCheck {
  // `--untracked-files=no` so a user authoring `<dir>/.brunch/cook/plan.yaml`
  // (which is untracked by definition) does not trip the gate. The gate only
  // refuses on modified or staged tracked files — the things cook could lose.
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    return { kind: 'not-git' };
  }
  const status = result.stdout.trim();
  if (status === '') return { kind: 'clean' };
  return { kind: 'dirty', status };
}

export async function runCook(opts: CookOptions, bus: CookBus): Promise<void> {
  const line = (text: string) => bus.emit({ kind: 'line', text });
  const promoting = <T>(label: string, fn: () => T): T => {
    bus.emit({ kind: 'activity-start', id: 'promote', label });
    try {
      return fn();
    } finally {
      bus.emit({ kind: 'activity-end', id: 'promote' });
    }
  };
  const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();

  // Streaming pre-flight happens before any cook side effect (banner, plan
  // load, sandbox creation). Without --petrinaut-stream there is no .env read
  // and no Petrinaut-URL check.
  let petrinautUrl: string | undefined;
  let streamPort: number | undefined;
  if (opts.petrinautStream) {
    loadLocalEnvFile(launchCwd);
    const resolvedUrl = resolvePetrinautUrl({
      cliFlag: opts.petrinautUrl,
      env: { PETRINAUT_URL: process.env.PETRINAUT_URL },
    });
    // Throw, never process.exit — the caller (withCookBus) must dispose the
    // presenter (unmount Ink) before the error is printed, or the TUI hangs.
    if ('error' in resolvedUrl) throw new Error(resolvedUrl.error);
    petrinautUrl = resolvedUrl.url;
    streamPort = resolvePetrinautStreamPort({ PORT: process.env.PORT });
  }

  const resolved = resolveCookPlan(opts.dir, opts.specId);
  if (resolved.kind === 'error') throw new Error(resolved.message);

  const plan = loadPlan(resolved.planPath);

  // Worktree strategy follows the plan's spec-derived mode, not its location.
  const sandbox = resolveSandboxPlan(plan.mode, resolved.sourceDir);
  if (sandbox.kind === 'error') throw new Error(sandbox.message);

  // Single shared tree only for serial greenfield (parallel would race on it);
  // every other case isolates slices per-slice.
  const sliceLayout = sandbox.kind === 'fixture' && opts.policy === 'serial' ? 'shared' : 'per-slice';

  const { sandboxDir, runDir, runId } =
    sandbox.kind === 'codebase'
      ? createSandbox(launchCwd, undefined, { mode: 'codebase', sourceDir: sandbox.sourceDir })
      : createSandbox(launchCwd);
  const reportsPath = join(runDir, 'reports.jsonl');

  const epicCount = plan.epics.length;
  const sliceCount = plan.slices.length;

  for (const l of cookBannerLines({
    policy: opts.policy,
    epicCount,
    sliceCount,
    maxRetries: opts.maxRetries,
    sandboxDir,
    reportsPath,
  })) {
    line(l);
  }

  const reports = new FileReportSink(reportsPath);
  const toolchain = resolveToolchain(plan.profile);

  // Fail-closed agent confinement: refuse to start the fleet if the toolchain
  // works unconfined but not under the sandbox profile (escape hatch: --confine=off).
  const confinementEnabled = opts.confine !== 'off';
  const guard = createSandboxGuard(sandboxDir);
  const preflight = await runConfinementPreflight(guard, toolchain.probeCommand(), opts.confine);
  if (preflight.action === 'refuse') {
    console.error(preflight.reason);
    process.exit(1);
  }
  if (preflight.action === 'proceed-degraded') {
    console.error(`  ⚠ ${preflight.warning}`);
  }
  console.error(`  confine    ${opts.confine === 'off' ? 'off' : guard.backend}`);
  console.error('');

  const testRunner = new ToolchainTestRunner(
    toolchain,
    confinementEnabled
      ? (argv, sliceSandboxDir) => createSandboxGuard(sliceSandboxDir).confineTest(argv)
      : undefined,
  );
  const engine = createOrchestrator(opts.policy);

  const runStart = Date.now();
  // Seed the presenter's elapsed clock; per-action progress carries no
  // pre-formatted timing — the presenter owns it (I136-K).
  bus.emit({ kind: 'cook-start', runStart });
  // Seed the slice grid up front so queued work is visible before it starts.
  bus.emit({
    kind: 'run-shape',
    epics: plan.epics.map((e) => ({ id: e.id })),
    slices: plan.slices.map((s) => ({ id: s.id, epicId: s.epic_id })),
    maxRetries: opts.maxRetries,
  });
  const actions = createPiActions({
    verbose: opts.verbose,
    emit: (event) => bus.emit(event),
    toolchain,
    testRunner,
    confine: confinementEnabled,
  });

  // Stand up the live-stream setup handle when streaming is enabled.
  // Auto-open is suppressed by `--no-petrinaut-open` or CI.
  const streamSetup =
    opts.petrinautStream && petrinautUrl
      ? createPetrinautStreamSetup({
          petrinautUrl,
          shouldOpen: opts.petrinautOpen && !process.env.CI,
          openUrl: defaultOpenUrl,
          log: (text) => line(text),
          ...(streamPort !== undefined ? { port: streamPort } : {}),
        })
      : undefined;

  try {
    const result = await engine.run({
      plan,
      sandboxDir,
      actions,
      reports,
      testRunner,
      policy: { maxRetries: opts.maxRetries },
      emit: (event) => bus.emit(event),
      sandboxMode: sandbox.kind === 'codebase' ? 'codebase' : 'fixture',
      sliceLayout,
      runId,
      runDir,
      // Pick the shared NetFolding (identity by default; color collapses subnets).
      petrinautFold: opts.petrinautFold,
      // Lane projection for Petrinaut export/stream (both by default).
      petrinautLanes: opts.petrinautLanes,
      ...(streamSetup ? { setupPetrinautStream: streamSetup.setupHook } : {}),
    });

    const duration = fmtDuration(Date.now() - runStart);
    const ok = result.status === 'completed';

    for (const l of cookSummaryLines({
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
      duration,
      warnings: result.warnings,
      epics: result.epics,
      slices: result.slices,
      planSlices: plan.slices,
      reportCount: result.reports.length,
      reportsPath,
    })) {
      line(l);
    }

    // Brownfield promotion is automatic (the result already lives on the repo's
    // own `brunch/run/<runId>` branch); greenfield promotion is opt-in via --out.
    // A run that did not complete promotes nothing — the artifact stays inspectable.
    if (sandbox.kind === 'codebase') {
      if (opts.outDir) {
        line(`  !  --out is ignored for brownfield; the result lands on ${brunchRef.run(runId)} in the repo`);
        line('');
      }
      if (!ok) {
        // cook-partial-promotion (FE-1082): salvage the slices of epics that
        // *did* complete (dependency-closed) instead of discarding the whole
        // run, and report the failed epic(s) as the diagnosis. Nothing to
        // salvage → the old all-or-nothing message.
        const salvage = selectSalvageableSlices(plan, result);
        if (salvage.sliceIds.length === 0) {
          line(`  !  run did not complete — nothing promoted. Artifact: ${sandboxDir}`);
          line('');
        } else {
          try {
            const artifact = promoting(
              `salvaging ${salvage.salvagedEpicIds.length} passing epic(s) → ${brunchRef.run(runId)}`,
              () =>
                harvestCookRun({
                  sourceDir: sandbox.sourceDir,
                  parentSandboxDir: sandboxDir,
                  runId,
                  plan,
                  completedSliceIds: salvage.sliceIds,
                }),
            );
            if (artifact.conflicts.length > 0) {
              for (const c of artifact.conflicts) {
                line(`  ✗  merge conflict in slice ${c.sliceId} on ${c.paths.join(', ')}`);
              }
              line(`  ✗  partial promotion halted at ${artifact.branch} @ ${artifact.head.slice(0, 8)}`);
            } else {
              line(
                `  ⚑  run halted — salvaged ${salvage.salvagedEpicIds.length} passing epic(s) to ${artifact.branch} @ ${artifact.head.slice(0, 8)}`,
              );
              line(
                `  ✗  unfinished epic(s): ${salvage.failedEpicIds.join(', ')}${result.reason ? ` — ${result.reason}` : ''}`,
              );
            }
            line(`     Full run worktree (for inspection): ${sandboxDir}`);
            line('');
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            line(`  !  partial promotion failed: ${reason}; nothing promoted. Artifact: ${sandboxDir}`);
            line('');
          }
        }
      } else {
        try {
          const completedSliceIds = result.slices
            .filter((s) => s.status === 'completed')
            .map((s) => s.sliceId);
          // Compose by git merge-tree fold (FE-883): per-slice history, fail-closed
          // on real conflicts, all plumbing (the user's checkout is never touched).
          const artifact = promoting(`promoting → ${brunchRef.run(runId)}`, () =>
            harvestCookRun({
              sourceDir: sandbox.sourceDir,
              parentSandboxDir: sandboxDir,
              runId,
              plan,
              completedSliceIds,
            }),
          );
          if (artifact.conflicts.length > 0) {
            for (const c of artifact.conflicts) {
              line(`  ✗  merge conflict in slice ${c.sliceId} on ${c.paths.join(', ')}`);
            }
            line(
              `  ✗  promotion halted at ${artifact.branch} @ ${artifact.head.slice(0, 8)} — resolve the conflict and re-run`,
            );
            line('');
            bus.emit({ kind: 'cook-done', ok: false, reason: 'promotion conflict' });
            recordCookExitStatus(false);
            return;
          }
          let land: CookFinishLand | undefined;
          if (opts.landBranch) {
            const landed = promoting(`landing → ${artifact.branch} into the active branch`, () =>
              landCookBranch({ sourceDir: sandbox.sourceDir, runId }),
            );
            if (landed.kind === 'landed') {
              land = { kind: 'landed', branch: landed.branch, mode: landed.mode };
            } else if (landed.kind === 'refused') {
              land = { kind: 'refused', reason: landed.reason };
            } else {
              land = { kind: 'conflict', branch: landed.branch };
            }
          }
          for (const l of cookFinishLines({
            shape: 'brownfield',
            dir: sandbox.sourceDir,
            branch: artifact.branch,
            commit: artifact.head,
            ...(land ? { land } : {}),
          })) {
            line(l);
          }
          // Completed + promoted: reclaim the run's worktrees + intermediate slice
          // branches (the brunch/run/<runId> artifact branch is kept). Best-effort —
          // cleanup must never fail a good run. Halted/conflicted runs returned
          // earlier, so they keep their worktrees for inspection (keep-on-failure).
          try {
            gcCookRun({ sourceDir: sandbox.sourceDir, runId, runDir });
          } catch {
            /* leave the run dir if cleanup hiccups; not worth failing a promoted run */
          }
        } catch (err) {
          const reason = `promotion failed: ${err instanceof Error ? err.message : String(err)}`;
          line(`  ✗  ${reason}`);
          line('');
          bus.emit({ kind: 'cook-done', ok: false, reason });
          recordCookExitStatus(false);
          return;
        }
      }
    } else if (opts.outDir) {
      if (!ok) {
        line(`  !  run did not complete — nothing promoted. Artifact: ${sandboxDir}`);
        line('');
      } else {
        try {
          const source = promotionSourceDir({
            sliceLayout,
            sandboxDir,
            runDir,
            plan,
            completedSliceIds: result.slices.filter((s) => s.status === 'completed').map((s) => s.sliceId),
            verifiedEpicSandboxes: verifiedEpicSandboxesFromReports(reports),
          });
          for (const c of source.conflicts) {
            line(`  !  merge conflict on ${c.path} (slices ${c.slices.join(', ')}; kept ${c.winner})`);
          }
          const promoted = promoting(`promoting → ${opts.outDir}`, () =>
            promoteGreenfieldRun({
              sandboxDir: source.dir,
              target: opts.outDir!,
              runId,
              force: opts.force,
            }),
          );
          for (const l of cookFinishLines({
            shape: 'greenfield',
            dir: promoted.target,
            branch: promoted.branch,
            commit: promoted.commit,
          })) {
            line(l);
          }
        } catch (err) {
          const reason = `promotion failed: ${err instanceof Error ? err.message : String(err)}`;
          line(`  ✗  ${reason}`);
          line('');
          bus.emit({ kind: 'cook-done', ok: false, reason });
          recordCookExitStatus(false);
          return;
        }
      }
    } else if (opts.landBranch) {
      // --land merges the cook branch into a repo's active branch; greenfield has
      // no such branch (it promotes to --out instead), so the flag is a no-op here.
      line(
        '  !  --land is ignored for greenfield runs (no repo branch to land onto; pass --out to promote the result)',
      );
      line('');
    }

    // Run complete (after promotion) — lights the brigade's `serve` phase, or
    // pins a halt summary with the reason when it did not complete.
    bus.emit({ kind: 'cook-done', ok, ...(result.reason ? { reason: result.reason } : {}) });
    recordCookExitStatus(ok);
    return;
  } finally {
    // Always tear down the SSE server, on success or failure.
    if (streamSetup) await streamSetup.stop();
  }
}
