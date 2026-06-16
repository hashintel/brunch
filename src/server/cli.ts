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
import { exitIfAnthropicApiKeyMissing, loadLocalEnvFile } from './runtime-config.js';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();

loadLocalEnvFile(launchCwd);

/**
 * Shared completed-spec gate for the spec-driven commands (`plan`, `serve`):
 * parse → open the project DB → assert the spec exists and is planning-ready →
 * run the command body → always close the DB. Parsing is passed as a thunk so a
 * parse error is reported through the same `Failed to run brunch <command>`
 * channel and exit code as the spec/DB errors. Keeps the two commands from
 * drifting on the gate while leaving each command's parsing and body its own.
 */
async function withCompletedSpec<O extends { specificationId: number }>(
  command: string,
  parse: () => O,
  run: (
    opts: O,
    ctx: {
      project: ReturnType<typeof resolveBrunchProject>;
      snapshot: ReturnType<typeof buildCompletedSpecSnapshot>;
    },
  ) => Promise<void>,
): Promise<void> {
  let db: ReturnType<typeof createDb> | undefined;
  try {
    const opts = parse();
    const project = resolveBrunchProject(launchCwd);
    db = createDb(project.dbPath);
    if (!getSpecification(db, opts.specificationId)) {
      throw new Error(`specification ${opts.specificationId} not found`);
    }
    const snapshot = buildCompletedSpecSnapshot(db, opts.specificationId);
    assertCompletedSpecReadyForPlanning(db, opts.specificationId, snapshot);
    await run(opts, { project, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to run brunch ${command}: ${message}`);
    process.exit(1);
  } finally {
    db?.$client.close();
  }
}

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
  console.log(
    '  serve <specId> [flags]    One shot: plan then cook a completed specification (no manual steps).',
  );
  console.log('');
  console.log('Environment:');
  console.log('  ANTHROPIC_API_KEY         Required. Brunch will not start without it; it powers the');
  console.log('                            interview and planning features. Set it in a .env file in');
  console.log('                            the project directory or your shell.');
  console.log('  ANTHROPIC_MODEL           Optional interviewer model override.');
  console.log('  BRUNCH_PORT               Optional port for the local web server.');
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
  console.log(
    '  --profile=<id>            Toolchain profile override (default: spec profile, else bun); persisted into plan.yaml',
  );
  console.log('  --verbose, -v             Verbose output');
  process.exit(0);
}

exitIfAnthropicApiKeyMissing();

if (rawArgs[0] === 'cook') {
  const { parseCookArgs, runCook } = await import('../orchestrator/src/cook-cli.js');
  const { withCookBus } = await import('../orchestrator/src/presenter.js');
  const opts = parseCookArgs(rawArgs.slice(1));
  // withCookBus disposes the bus (unmounts the Ink app) in finally so the TTY run exits.
  await withCookBus('cook', (bus) => runCook(opts, bus)).catch((error) => {
    console.error('Failed to run brunch cook:', error);
    process.exit(1);
  });
} else if (rawArgs[0] === 'serve') {
  const { runPlan } = await import('./plan-runner.js');
  const { runCook } = await import('../orchestrator/src/cook-cli.js');
  const { parseServeArgs, runServe } = await import('./serve-runner.js');
  const { withCookBus } = await import('../orchestrator/src/presenter.js');
  await withCookBus('serve', (bus) =>
    withCompletedSpec(
      'serve',
      () => parseServeArgs(rawArgs.slice(1)),
      async (opts, { project, snapshot }) => {
        // Cook runs against the same dir the plan was written to (launchCwd); see
        // serveCookOptions — runCook reads opts.dir raw, so serve must thread it.
        await runServe(opts, launchCwd, {
          plan: () =>
            runPlan({
              specificationId: opts.specificationId,
              snapshot,
              outDir: launchCwd,
              verbose: opts.verbose,
              profile: opts.profile,
              // Brownfield detection reads the launch cwd (the user's repo); greenfield ignores it.
              repoDir: project.cwd,
              bus,
            }),
          cook: (cookOpts) => runCook(cookOpts, bus),
        });
      },
    ),
  );
} else if (rawArgs[0] === 'plan') {
  const { parsePlanArgs, runPlan } = await import('./plan-runner.js');
  const { withCookBus } = await import('../orchestrator/src/presenter.js');
  await withCookBus('plan', (bus) =>
    withCompletedSpec(
      'plan',
      () => parsePlanArgs(rawArgs.slice(1), launchCwd),
      async (opts, { project, snapshot }) => {
        await runPlan({
          specificationId: opts.specificationId,
          snapshot,
          outDir: opts.outDir,
          verbose: opts.verbose,
          profile: opts.profile,
          // Brownfield detection reads the launch cwd (the user's repo); greenfield ignores it.
          repoDir: project.cwd,
          bus,
        });
      },
    ),
  );
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
