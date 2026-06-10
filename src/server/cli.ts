#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAgentJsonlSession } from './agent-jsonl.js';
import { createDb, getSpecification } from './db.js';
import {
  assertCompletedSpecReadyForPlanning,
  buildCompletedSpecSnapshot,
} from './db/completed-spec-snapshot.js';
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
  console.log('  cook [dir] [flags]        Run the orchestrator on a plan directory (default: cwd).');
  console.log(
    '  plan <specId> [flags]     Emit .brunch/cook/specs/<specId>/plan.yaml from a completed specification.',
  );
  console.log('');
  console.log('Cook flags:');
  console.log(
    '  --spec=<id>                      Pick .brunch/cook/specs/<id>/plan.yaml (default: newest spec)',
  );
  console.log(
    '  --policy=serial|parallel         Firing policy (default: serial; serial greenfield runs in one shared tree)',
  );
  console.log('  --max-retries=N                  Retry budget per slice (default: 3)');
  console.log(
    '  --out=<dir>                      Promote a completed greenfield run into <dir> as a git commit',
  );
  console.log(
    '  --force                          Allow --out promotion into a non-empty target (lands on cook/<runId>)',
  );
  console.log('  --petrinaut-fold=color|identity  Petri-net projection mode (default: identity)');
  console.log(
    '  --petrinaut-lanes=both|mechanical  Lane projection; mechanical hides the semantic lane (default: both)',
  );
  console.log(
    '  --petrinaut-stream               Stream the live run to Petrinaut over SSE (opt-in; default off)',
  );
  console.log(
    '  --petrinaut-url=<url>            Petrinaut route URL incl. path, e.g. https://…/brunch (requires --petrinaut-stream; else PETRINAUT_URL env)',
  );
  console.log(
    "  --no-petrinaut-open              Don't auto-open the browser (requires --petrinaut-stream; URL still prints)",
  );
  console.log('  --verbose, -v                    Show raw pi-agent output');
  console.log('');
  console.log('Cook env:');
  console.log(
    '  PETRINAUT_URL                    Petrinaut route URL incl. path for --petrinaut-stream (overridden by --petrinaut-url; shell-wins over .env)',
  );
  console.log(
    '  PORT                             Pin the SSE server port (default: ephemeral); avoid browser-blocked ports (e.g. 6000)',
  );
  console.log('');
  console.log('Plan flags:');
  console.log(
    '  --out=<dir>               Output directory (default: cwd); plan lands under .brunch/cook/specs/<specId>/',
  );
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
    const opts = parsePlanArgs(rawArgs.slice(1), launchCwd);
    const project = resolveBrunchProject(launchCwd);
    db = createDb(project.dbPath);
    if (!getSpecification(db, opts.specificationId)) {
      throw new Error(`specification ${opts.specificationId} not found`);
    }
    const snapshot = buildCompletedSpecSnapshot(db, opts.specificationId);
    assertCompletedSpecReadyForPlanning(db, opts.specificationId, snapshot);
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
