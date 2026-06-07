import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderNeighborhoodPreview } from '../graph/render-preview.js';

type RendererName = 'graph-neighborhood';

interface CliOptions {
  readonly renderer: RendererName;
  readonly set: string;
  readonly fixture: string;
  readonly anchorCode: string;
  readonly outputPath?: string;
  readonly hops?: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = resolve(HERE, '../renderers/graph/__previews__');

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const rendered = render(options);
  const outputPath = options.outputPath ?? resolve(DEFAULT_OUTPUT_DIR, defaultPreviewFileName(options));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered, 'utf8');

  console.log(outputPath);
}

function render(options: CliOptions): string {
  switch (options.renderer) {
    case 'graph-neighborhood':
      return renderNeighborhoodPreview({
        set: options.set,
        fixture: options.fixture,
        anchorCode: options.anchorCode,
        ...(options.hops === undefined ? {} : { hops: options.hops }),
      });
  }
}

function defaultPreviewFileName(options: CliOptions): string {
  switch (options.renderer) {
    case 'graph-neighborhood':
      return `neighborhood-${options.fixture}-${options.anchorCode}.preview.md`;
  }
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.length < 4) {
    throw new Error(
      'Usage: npm run render -- graph-neighborhood <seed-set> <fixture-slug> <anchor-code> [--output <path>] [--hops <n>]',
    );
  }

  const [rendererValue, setValue, fixtureValue, anchorCodeValue, ...rest] = argv;
  const renderer = rendererValue;
  const set = setValue;
  const fixture = fixtureValue;
  const anchorCode = anchorCodeValue;
  if (!renderer || !set || !fixture || !anchorCode) {
    throw new Error(
      'Usage: npm run render -- graph-neighborhood <seed-set> <fixture-slug> <anchor-code> [--output <path>] [--hops <n>]',
    );
  }
  if (renderer !== 'graph-neighborhood') {
    throw new Error(`Unknown renderer "${renderer}". Supported renderers: graph-neighborhood`);
  }

  let outputPath: string | undefined;
  let hops: number | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];

    if (flag === '--output') {
      if (!value) throw new Error('--output requires a path');
      outputPath = resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    if (flag === '--hops') {
      if (!value) throw new Error('--hops requires a numeric value');
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`--hops must be a positive integer; received "${value}"`);
      }
      hops = parsed;
      index += 1;
      continue;
    }

    throw new Error(`Unknown flag "${flag}"`);
  }

  return {
    renderer,
    set,
    fixture,
    anchorCode,
    ...(outputPath === undefined ? {} : { outputPath }),
    ...(hops === undefined ? {} : { hops }),
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
