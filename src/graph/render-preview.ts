import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../db/connection.js';
import { projectNeighborhood } from '../projections/graph/neighborhood.js';
import { formatNeighborhood } from '../renderers/graph/neighborhood.js';
import { CommandExecutor } from './command-executor.js';
import { getNodeNeighborhood, resolveGraphNodeCode } from './queries.js';
import { seedFixture, type SeedFixture } from './seed-fixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEDS_ROOT = resolve(HERE, '../../.fixtures/seeds');

export interface NeighborhoodPreviewOptions {
  readonly set: string;
  readonly fixture: string;
  readonly anchorCode: string;
  readonly hops?: number;
}

export function renderNeighborhoodPreview(options: NeighborhoodPreviewOptions): string {
  const fixture = loadFixture(options.set, options.fixture);
  const db = createDb(':memory:');
  const executor = new CommandExecutor(db);
  const seeded = seedFixture(executor, fixture);
  const anchorId = resolveGraphNodeCode(db, seeded.specId, options.anchorCode);

  if (!anchorId) {
    throw new Error(
      `renderNeighborhoodPreview: anchor code "${options.anchorCode}" not found in ${options.set}/${options.fixture}`,
    );
  }

  const neighborhood = getNodeNeighborhood(db, seeded.specId, anchorId, { hops: options.hops ?? 1 });
  return formatNeighborhood(projectNeighborhood(neighborhood));
}

function loadFixture(set: string, fixture: string): SeedFixture {
  const fixturePath = resolve(SEEDS_ROOT, set, `${fixture}.json`);
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as SeedFixture;
}
