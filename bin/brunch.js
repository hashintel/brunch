#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliEntrypoint = join(packageRoot, 'src', 'server', 'cli.ts');
const require = createRequire(import.meta.url);
const tsxEntrypoint = require.resolve('tsx');

const child = spawn(process.execPath, ['--import', tsxEntrypoint, cliEntrypoint, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to start brunch:', error);
  process.exit(1);
});
