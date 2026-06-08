import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createOrchestrator } from './engine.js';
import { FileReportSink } from './file-report-sink.js';
import { loadLocalEnvFile } from './local-env.js';
import type { FiringPolicy } from './petri-net.js';
import { composeLauncherUrl, resolvePetrinautUrl } from './petrinaut-launcher-url.js';
import { createPetrinautStreamBus, type PetrinautStreamBus } from './petrinaut-stream-bus.js';
import { createPetrinautStreamServer, type PetrinautStreamServer } from './petrinaut-stream-server.js';
import { createPiActions } from './pi-actions.js';
import { loadPlan } from './plan-loader.js';
import { parseSpecId, resolveLatestSpecPlanPath, specPlanPath, specsRootDir } from './spec-plan-paths.js';
import { BunTestRunner } from './test-runner.js';
import { createSandbox } from './worktree.js';

/**
 * Which `NetFolding` constructor the cook run uses for Petrinaut export
 * (`net.json`, SDCPN file, live event stream). `identity` (default) keeps
 * the unfolded per-slice net so the demo / small-N visualization shows the
 * full per-slice lifecycle; `color` collapses N structurally-identical slice
 * subnets into one and carries slice identity on the token color.
 */
export type PetrinautFoldMode = 'color' | 'identity';

export type CookOptions = {
  dir: string;
  policy: FiringPolicy;
  maxRetries: number;
  verbose: boolean;
  petrinautFold: PetrinautFoldMode;
  /** When true, runCook boots the ephemeral SSE server and composes the launcher URL. */
  petrinautStream: boolean;
  /** Optional CLI override for the Petrinaut route URL (full path included). */
  petrinautUrl?: string;
  /** Whether to auto-launch the system browser; CI=true also suppresses at runtime. */
  petrinautOpen: boolean;
  /**
   * Explicit specification id whose emitted plan (under
   * `<dir>/.brunch/cook/specs/<id>/plan.yaml`) should be cooked.
   * When omitted, `resolveCookMode` auto-picks the most recently
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
  let petrinautStream = false;
  let petrinautUrl: string | undefined;
  let petrinautOpen = true;
  let specId: number | undefined;
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
    } else if (arg === '--petrinaut-stream') {
      petrinautStream = true;
    } else if (arg.startsWith('--petrinaut-url=')) {
      petrinautUrl = arg.split('=').slice(1).join('=');
      sawUrl = true;
    } else if (arg === '--no-petrinaut-open') {
      petrinautOpen = false;
      sawNoOpen = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      dir = arg;
    }
  }

  if (!dir) {
    throw new Error(
      'Usage: brunch cook <dir> [--spec=<id>] [--policy=serial|parallel] [--max-retries=N] [--petrinaut-fold=color|identity] [--petrinaut-stream [--petrinaut-url=<url>] [--no-petrinaut-open]] [--verbose]',
    );
  }

  // Companion-flag validation: stream-only flags require --petrinaut-stream.
  if (sawUrl && !petrinautStream) {
    throw new Error('--petrinaut-url requires --petrinaut-stream');
  }
  if (sawNoOpen && !petrinautStream) {
    throw new Error('--no-petrinaut-open requires --petrinaut-stream');
  }

  return {
    dir: resolve(dir),
    policy,
    maxRetries,
    verbose,
    petrinautFold,
    petrinautStream,
    petrinautUrl,
    petrinautOpen,
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

export type ResolvedCookMode =
  | { mode: 'fixture'; planPath: string }
  | { mode: 'codebase'; planPath: string; sourceDir: string }
  | { mode: 'error'; message: string };

/**
 * Resolve cook's run mode by inspecting `<dir>` in precedence order:
 *
 *   1. `<dir>/plan.yaml` exists                                  → fixture mode (greenfield).
 *   2. Explicit `specId`:
 *        `<dir>/.brunch/cook/specs/<id>/plan.yaml` exists        → codebase mode.
 *        missing                                                 → error.
 *   3. No `specId`, any `<dir>/.brunch/cook/specs/<n>/plan.yaml` → newest by mtime, codebase mode.
 *   4. Legacy `<dir>/.brunch/cook/plan.yaml`                     → codebase mode.
 *   5. None of the above                                         → error.
 *
 * Codebase modes additionally require `<dir>` to be a git repo with a clean
 * working tree (untracked files ignored).
 *
 * Pure function — no process exits, no side effects beyond filesystem reads.
 */
export function resolveCookMode(dir: string, specId?: number): ResolvedCookMode {
  const fixturePath = join(dir, 'plan.yaml');
  if (existsSync(fixturePath)) {
    return { mode: 'fixture', planPath: fixturePath };
  }

  const legacyPath = join(dir, '.brunch', 'cook', 'plan.yaml');

  let codebasePath: string | undefined;
  if (specId !== undefined) {
    const explicit = specPlanPath(dir, specId);
    if (!existsSync(explicit)) {
      return { mode: 'error', message: `No plan emitted for spec ${specId}: ${explicit}` };
    }
    codebasePath = explicit;
  } else {
    codebasePath = resolveLatestSpecPlanPath(dir) ?? (existsSync(legacyPath) ? legacyPath : undefined);
  }

  if (codebasePath) {
    const gitCheck = isCleanGitWorkingTree(dir);
    if (gitCheck.kind === 'not-git') {
      return { mode: 'error', message: `Codebase mode requires <dir> to be a git repo: ${dir}` };
    }
    if (gitCheck.kind === 'dirty') {
      return {
        mode: 'error',
        message: `Codebase mode refuses to run against an uncommitted working tree:\n${gitCheck.status}`,
      };
    }
    return { mode: 'codebase', planPath: codebasePath, sourceDir: dir };
  }

  return {
    mode: 'error',
    message: `No plan found at ${fixturePath}, ${specsRootDir(dir)}/<id>/plan.yaml, or ${legacyPath}`,
  };
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

export async function runCook(opts: CookOptions): Promise<void> {
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
    if ('error' in resolvedUrl) {
      console.error(resolvedUrl.error);
      process.exit(1);
    }
    petrinautUrl = resolvedUrl.url;
    streamPort = resolvePetrinautStreamPort({ PORT: process.env.PORT });
  }

  const resolved = resolveCookMode(opts.dir, opts.specId);
  if (resolved.mode === 'error') {
    console.error(resolved.message);
    process.exit(1);
  }

  const plan = loadPlan(resolved.planPath);
  const { sandboxDir, runDir, runId } =
    resolved.mode === 'codebase'
      ? createSandbox(launchCwd, undefined, { mode: 'codebase', sourceDir: resolved.sourceDir })
      : createSandbox(launchCwd);
  const reportsPath = join(runDir, 'reports.jsonl');

  const epicCount = plan.epics.length;
  const sliceCount = plan.slices.length;

  console.error('');
  console.error(`  brunch cook`);
  console.error(`  ──────────────────────────────────────`);
  console.error(`  policy     ${opts.policy}`);
  console.error(`  plan       ${epicCount} epics, ${sliceCount} slices`);
  console.error(`  retries    ${opts.maxRetries}`);
  console.error(`  sandbox    ${sandboxDir}`);
  console.error(`  reports    ${reportsPath}`);
  console.error('');

  const reports = new FileReportSink(reportsPath);
  const testRunner = new BunTestRunner();

  const engine = createOrchestrator(opts.policy);

  const runStart = Date.now();
  const actions = createPiActions({ verbose: opts.verbose, runStart });

  // Stand up the live-stream setup handle when streaming is enabled.
  // Auto-open is suppressed by `--no-petrinaut-open` or CI.
  const streamSetup =
    opts.petrinautStream && petrinautUrl
      ? createPetrinautStreamSetup({
          petrinautUrl,
          shouldOpen: opts.petrinautOpen && !process.env.CI,
          openUrl: defaultOpenUrl,
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
      sandboxMode: resolved.mode === 'codebase' ? 'codebase' : 'fixture',
      runId,
      runDir,
      // Pick the shared NetFolding (identity by default; color collapses subnets).
      petrinautFold: opts.petrinautFold,
      ...(streamSetup ? { setupPetrinautStream: streamSetup.setupHook } : {}),
    });

    const duration = fmtDuration(Date.now() - runStart);
    const ok = result.status === 'completed';

    console.error('');
    console.error(`  ──────────────────────────────────────`);
    console.error(
      `  ${ok ? '✓' : '✗'}  ${result.status}${result.reason ? ` — ${result.reason}` : ''}  (${duration})`,
    );
    for (const warning of result.warnings) {
      console.error(`  !  ${warning}`);
    }
    console.error('');

    for (const e of result.epics) {
      const icon = e.status === 'completed' ? '✓' : '✗';
      const slices = result.slices.filter(
        (s) => plan.slices.find((ps) => ps.id === s.sliceId)?.epic_id === e.epicId,
      );
      const sliceSummary = slices
        .map((s) => `${s.status === 'completed' ? '✓' : '✗'} ${s.sliceId}`)
        .join('  ');
      console.error(`  ${icon}  ${e.epicId}`);
      console.error(`     ${sliceSummary}`);
    }

    console.error('');
    console.error(`  ${result.reports.length} events → ${reportsPath}`);
    console.error('');

    recordCookExitStatus(ok);
    return;
  } finally {
    // Always tear down the SSE server, on success or failure.
    if (streamSetup) await streamSetup.stop();
  }
}
