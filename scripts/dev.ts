import process from 'node:process';

import { runDevCli } from '../src/dev/dev-cli.js';

async function main(): Promise<void> {
  process.exitCode = await runDevCli();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
