#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAgentJsonlSession } from './agent-jsonl.js';
import { createDb, getSpecification } from './db.js';
import { buildCompletedSpecSnapshot } from './db/completed-spec-snapshot.js';
import { launch } from './launcher.js';
import { resolveBrunchProject } from './project.js';
import { loadLocalEnvFile } from './runtime-config.js';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();

loadLocalEnvFile(launchCwd);

if (rawArgs[0] === '--version' || rawArgs[0] === '-V') {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json');
  const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  console.log(version);
  process.exit(0);
}

if (args.has('--help') || args.has('-h') || args.has('help')) {
  console.log('Usage: brunch [command]');
  console.log('');
  console.log('Launch the Brunch web UI in the current project directory.');
  console.log('');
  console.log('Commands:');
  console.log('  agent                     Run a JSONL capability session on stdin/stdout.');
  console.log('  cook <dir> [flags]        Run the orchestrator on a plan directory.');
  console.log(
    '  plan <specId> [flags]     Emit .brunch/cook/specs/<specId>/plan.yaml from a completed specification.',
  );
  console.log('');
  console.log('Cook flags:');
  console.log('  --spec=<id>               Pick .brunch/cook/specs/<id>/plan.yaml (default: newest spec)');
  console.log('  --policy=serial|parallel  Firing policy (default: serial)');
  console.log('  --max-retries=N           Retry budget per slice (default: 3)');
  console.log('  --verbose, -v             Show raw pi-agent output');
  console.log('');
  console.log('Plan flags:');
  console.log('  --out=<dir>               Output directory (default: cwd)');
  console.log('  --verbose, -v             Verbose output');
  process.exit(0);
}

if (rawArgs[0] === 'cook') {
  const { parseCookArgs, runCook } = await import('../orchestrator/src/cook-cli.js');
  const opts = parseCookArgs(rawArgs.slice(1));
  runCook(opts).catch((error) => {
    console.error('Failed to run brunch cook:', error);
    process.exit(1);
  });
} else if (rawArgs[0] === 'plan') {
  const { parsePlanArgs, runPlan } = await import('./plan-runner.js');
  let db: ReturnType<typeof createDb> | undefined;
  try {
    const opts = parsePlanArgs(rawArgs.slice(1));
    const project = resolveBrunchProject(launchCwd);
    db = createDb(project.dbPath);
    if (!getSpecification(db, opts.specificationId)) {
      throw new Error(`specification ${opts.specificationId} not found`);
    }
    const snapshot = buildCompletedSpecSnapshot(db, opts.specificationId);
    if (snapshot.requirements.length === 0) {
      throw new Error(
        `specification ${opts.specificationId} has no accepted requirements — confirm the requirements phase before planning`,
      );
    }
    await runPlan({
      specificationId: opts.specificationId,
      snapshot,
      outDir: opts.outDir,
      verbose: opts.verbose,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to run brunch plan: ${message}`);
    process.exit(1);
  } finally {
    db?.$client.close();
  }
} else if (rawArgs[0] === 'agent') {
  const project = resolveBrunchProject(launchCwd);
  const db = createDb(project.dbPath);
  runAgentJsonlSession({ db, input: process.stdin, output: process.stdout, projectCwd: project.cwd })
    .then(() => {
      db.$client.close();
    })
    .catch((error) => {
      db.$client.close();
      console.error('Failed to run brunch agent session:', error);
      process.exit(1);
    });
} else {
  launch(launchCwd).catch((error) => {
    console.error('Failed to start brunch:', error);
    process.exit(1);
  });
}
