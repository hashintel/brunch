import process from 'node:process';

import { runComponentPreviewGallery } from '../src/dev/component-preview.js';

async function main(): Promise<void> {
  const entryId = process.argv[2];
  await runComponentPreviewGallery({ entryId });
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
