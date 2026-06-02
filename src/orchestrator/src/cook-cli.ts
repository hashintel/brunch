import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createOrchestrator } from './engine.js';
import { FileReportSink } from './file-report-sink.js';
import type { FiringPolicy } from './petri-net.js';
import { createPiActions } from './pi-actions.js';
import { loadPlan } from './plan-loader.js';
import { BunTestRunner } from './test-runner.js';
import { createSandbox } from './worktree.js';

export type CookOptions = {
  dir: string;
  policy: FiringPolicy;
  maxRetries: number;
  verbose: boolean;
};

export function parseCookArgs(args: string[]): CookOptions {
  let dir = '';
  let policy: FiringPolicy = 'serial';
  let maxRetries = 3;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--policy=')) {
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
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      dir = arg;
    }
  }

  if (!dir) {
    throw new Error('Usage: brunch cook <dir> [--policy=serial|parallel] [--max-retries=N] [--verbose]');
  }

  return { dir: resolve(dir), policy, maxRetries, verbose };
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
 * Resolve cook's run mode by inspecting `<dir>`:
 *   - `<dir>/plan.yaml` exists           → fixture mode (greenfield).
 *   - `<dir>/.brunch/cook/plan.yaml`     → codebase mode (brownfield); requires
 *                                          `<dir>` to be a git repo with a clean
 *                                          working tree.
 *   - neither                            → error.
 *
 * Pure function — no process exits, no side effects beyond filesystem reads.
 */
export function resolveCookMode(dir: string): ResolvedCookMode {
  const fixturePath = join(dir, 'plan.yaml');
  if (existsSync(fixturePath)) {
    return { mode: 'fixture', planPath: fixturePath };
  }

  const codebasePath = join(dir, '.brunch', 'cook', 'plan.yaml');
  if (existsSync(codebasePath)) {
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

  return { mode: 'error', message: `No plan found at ${fixturePath} or ${codebasePath}` };
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
  const resolved = resolveCookMode(opts.dir);
  if (resolved.mode === 'error') {
    console.error(resolved.message);
    process.exit(1);
  }

  const plan = loadPlan(resolved.planPath);
  const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();
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

  const result = await engine.run({
    plan,
    sandboxDir,
    actions,
    reports,
    testRunner,
    policy: { maxRetries: opts.maxRetries },
    sandboxMode: resolved.mode === 'codebase' ? 'codebase' : 'fixture',
    runId,
    // FE-762: engine writes Petrinaut net.json into the run directory.
    runDir,
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
    const sliceSummary = slices.map((s) => `${s.status === 'completed' ? '✓' : '✗'} ${s.sliceId}`).join('  ');
    console.error(`  ${icon}  ${e.epicId}`);
    console.error(`     ${sliceSummary}`);
  }

  console.error('');
  console.error(`  ${result.reports.length} events → ${reportsPath}`);
  console.error('');

  process.exit(ok ? 0 : 1);
}
