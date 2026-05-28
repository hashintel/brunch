#!/usr/bin/env node

import { runAgentJsonlSession } from './agent-jsonl.js';
import { createDb } from './db.js';
import { launch } from './launcher.js';
import { resolveBrunchProject } from './project.js';
import { loadLocalEnvFile } from './runtime-config.js';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();

loadLocalEnvFile(launchCwd);

if (args.has('--help') || args.has('-h') || args.has('help')) {
  console.log('Usage: brunch [command]');
  console.log('');
  console.log('Launch the Brunch web UI in the current project directory.');
  console.log('');
  console.log('Commands:');
  console.log('  agent              Run a JSONL capability session on stdin/stdout.');
  console.log('  cook <dir> [flags] Run the orchestrator on a plan directory.');
  console.log('');
  console.log('Cook flags:');
  console.log('  --engine=proc|petri  Execution engine (default: petri)');
  console.log('  --max-retries=N      Retry budget per slice (default: 3)');
  console.log('  --verbose, -v        Show raw pi-agent output');
  process.exit(0);
}

if (rawArgs[0] === 'cook') {
  const { parseCookArgs, runCook } = await import('../orchestrator/src/cook-cli.js');
  const opts = parseCookArgs(rawArgs.slice(1));
  runCook(opts).catch((error) => {
    console.error('Failed to run brunch cook:', error);
    process.exit(1);
  });
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
