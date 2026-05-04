#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliEntrypoint = join(packageRoot, 'dist', 'server', 'cli.js');
const launchCwd = process.cwd();

if (!existsSync(cliEntrypoint)) {
  console.error(`Missing compiled Brunch runtime at ${cliEntrypoint}. Run \`npm run build\` first.`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['--no-warnings=ExperimentalWarning', cliEntrypoint, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    cwd: packageRoot,
    env: { ...process.env, BRUNCH_LAUNCH_CWD: launchCwd },
  },
);

child.on('close', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to start brunch:', error);
  process.exit(1);
});
