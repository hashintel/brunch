import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
};

export function parseCookArgs(args: string[]): CookOptions {
  let dir = '';
  let engine: 'proc' | 'petri' = 'proc';
  let maxRetries = 3;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--engine=')) {
      const val = arg.split('=')[1]!;
      if (val !== 'proc' && val !== 'petri') {
        throw new Error(`Unknown engine: ${val}. Use proc or petri.`);
      }
      engine = val;
    } else if (arg.startsWith('--max-retries=')) {
      maxRetries = Number.parseInt(arg.split('=')[1]!, 10);
    } else if (!arg.startsWith('-')) {
      dir = arg;
    }
  }

  if (!dir) {
    throw new Error('Usage: brunch cook <dir> [--engine=proc|petri] [--max-retries=N]');
  }

  return { dir: resolve(dir), engine, maxRetries };
}

export async function runCook(opts: CookOptions): Promise<void> {
  const planPath = join(opts.dir, 'plan.yaml');
  if (!existsSync(planPath)) {
    // Check for codebase mode (reserved)
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
  const { worktreeDir, runId } = createWorktree(opts.dir);
  const reportsPath = join(opts.dir, '.cook', 'runs', runId, 'reports.jsonl');

  console.error(`[cook] Engine: ${opts.engine}`);
  console.error(`[cook] Plan: ${plan.epics.length} epics, ${plan.slices.length} slices`);
  console.error(`[cook] Worktree: ${worktreeDir}`);
  console.error(`[cook] Reports: ${reportsPath}`);

  const reports = new FileReportSink(reportsPath);
  const actions = createPiActions();
  const testRunner = new BunTestRunner();

  const engine: Orchestrator =
    opts.engine === 'petri' ? new PetriOrchestrator() : new ProceduralOrchestrator();

  const result = await engine.run({
    plan,
    fixtureDir: worktreeDir,
    actions,
    reports,
    testRunner,
    policy: { maxRetries: opts.maxRetries },
  });

  console.error(`\n[cook] Result: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`);
  console.error(`[cook] Epics: ${result.epics.map((e) => `${e.epicId}:${e.status}`).join(', ')}`);
  console.error(`[cook] Slices: ${result.slices.map((s) => `${s.sliceId}:${s.status}`).join(', ')}`);
  console.error(`[cook] Reports: ${result.reports.length} events`);

  process.exit(result.status === 'completed' ? 0 : 1);
}
