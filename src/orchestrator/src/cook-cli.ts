import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PetriOrchestrator } from './engine-petri.js';
import { ProceduralOrchestrator } from './engine-proc.js';
import { FileReportSink } from './file-report-sink.js';
import { createPiActions } from './pi-actions.js';
import { loadPlan } from './plan-loader.js';
import { BunTestRunner } from './test-runner.js';
import type { Orchestrator } from './types.js';
import { createWorktree } from './worktree.js';

export type CookOptions = {
  dir: string;
  engine: 'proc' | 'petri';
  maxRetries: number;
  verbose: boolean;
};

export function parseCookArgs(args: string[]): CookOptions {
  let dir = '';
  let engine: 'proc' | 'petri' = 'proc';
  let maxRetries = 3;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--engine=')) {
      const val = arg.split('=')[1]!;
      if (val !== 'proc' && val !== 'petri') {
        throw new Error(`Unknown engine: ${val}. Use proc or petri.`);
      }
      engine = val;
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
    throw new Error('Usage: brunch cook <dir> [--engine=proc|petri] [--max-retries=N] [--verbose]');
  }

  return { dir: resolve(dir), engine, maxRetries, verbose };
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

export async function runCook(opts: CookOptions): Promise<void> {
  const planPath = join(opts.dir, 'plan.yaml');
  if (!existsSync(planPath)) {
    const codebasePlanPath = join(opts.dir, '.cook', 'plan.yaml');
    if (existsSync(codebasePlanPath)) {
      console.error('Codebase mode (brownfield) is not yet implemented.');
      console.error('POC supports fixture mode only: place plan.yaml at the root of <dir>.');
      process.exit(1);
    }
    console.error(`No plan found at ${planPath}`);
    process.exit(1);
  }

  const plan = loadPlan(planPath);
  const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();
  const { worktreeDir, runDir } = createWorktree(launchCwd);
  const reportsPath = join(runDir, 'reports.jsonl');

  const epicCount = plan.epics.length;
  const sliceCount = plan.slices.length;

  console.error('');
  console.error(`  brunch cook`);
  console.error(`  ──────────────────────────────────────`);
  console.error(`  engine     ${opts.engine}`);
  console.error(`  plan       ${epicCount} epics, ${sliceCount} slices`);
  console.error(`  retries    ${opts.maxRetries}`);
  console.error(`  worktree   ${worktreeDir}`);
  console.error(`  reports    ${reportsPath}`);
  console.error('');

  const reports = new FileReportSink(reportsPath);
  const actions = createPiActions({ verbose: opts.verbose });
  const testRunner = new BunTestRunner();

  const engine: Orchestrator =
    opts.engine === 'petri' ? new PetriOrchestrator() : new ProceduralOrchestrator();

  const t0 = Date.now();

  const result = await engine.run({
    plan,
    worktreeDir,
    actions,
    reports,
    testRunner,
    policy: { maxRetries: opts.maxRetries },
  });

  const duration = fmtDuration(Date.now() - t0);
  const ok = result.status === 'completed';

  console.error('');
  console.error(`  ──────────────────────────────────────`);
  console.error(
    `  ${ok ? '✓' : '✗'}  ${result.status}${result.reason ? ` — ${result.reason}` : ''}  (${duration})`,
  );
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
