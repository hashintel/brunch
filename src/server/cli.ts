#!/usr/bin/env node

import { launch } from './launcher.js';
import { loadLocalEnvFile } from './runtime-config.js';

const args = new Set(process.argv.slice(2));
const launchCwd = process.env.BRUNCH_LAUNCH_CWD || process.cwd();

loadLocalEnvFile(launchCwd);

if (args.has('--help') || args.has('-h') || args.has('help')) {
  console.log('Usage: brunch');
  console.log('');
  console.log('Launch the Brunch web UI in the current project directory.');
  process.exit(0);
}

launch(launchCwd).catch((error) => {
  console.error('Failed to start brunch:', error);
  process.exit(1);
});
