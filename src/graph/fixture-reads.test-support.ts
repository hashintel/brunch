import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { getNodes, queryGraph, type GraphSlice, type NodeNeighborhood } from './queries.js';
import { seedFixture, type SeedFixture } from './seed-fixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEDS_ROOT = resolve(HERE, '../../.fixtures/seeds');

export interface SeedFixtureRef {
  readonly set: string;
  readonly fixture: string;
}

export function readGraphSliceFixture(ref: SeedFixtureRef): GraphSlice {
  const { db, specId } = seedSelectedSpec(ref);
  return queryGraph(db, specId);
}

export function readNodeNeighborhoodFixture(
  ref: SeedFixtureRef & { readonly anchorCode: string; readonly hops?: number },
): Extract<NodeNeighborhood, { status: 'found' }> {
  const { db, specId } = seedSelectedSpec(ref);
  const result = getNodes(db, specId, [{ code: ref.anchorCode }], {
    hops: ref.hops ?? 1,
  })[0];

  if (!result || result.status === 'not_found') {
    throw new Error(`Node code "${ref.anchorCode}" not found in ${ref.set}/${ref.fixture}`);
  }

  return result;
}

function seedSelectedSpec(ref: SeedFixtureRef) {
  const fixturePath = resolve(SEEDS_ROOT, ref.set, `${ref.fixture}.json`);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as SeedFixture;
  const db = createDb(':memory:');
  const executor = new CommandExecutor(db);
  const seeded = seedFixture(executor, fixture);

  return { db, specId: seeded.specId };
}
