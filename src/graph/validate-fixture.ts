/**
 * Dev CLI: validate one seed fixture against the real propose-graph validator.
 *
 * Seeds `.fixtures/seeds/<set>/<slug>.json` into an in-memory database through
 * the same `CommandExecutor` mutation boundary the live product uses, so a
 * fixture that loads here is structurally legal (valid plane/kind, per-kind
 * detail rules, edge category/stance rules, no self-loops, acyclic
 * supersession). On rejection it prints the command-layer diagnostics; on
 * success it prints stored totals plus the active-context projection totals
 * (which hide superseded predecessors and their dangling edges).
 *
 * This is the fast authoring loop for porting prose spec/plan docs into
 * fixtures — it touches no shared test file, so multiple fixtures can be
 * authored and validated independently.
 *
 *   npx tsx src/graph/validate-fixture.ts <set>/<slug>
 *   npx tsx src/graph/validate-fixture.ts brunch-self/spec-graph
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { queryGraph } from './queries.js';
import { seedFixture, type SeedFixture } from './seed-fixtures.js';

const SEEDS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../.fixtures/seeds');

function validateFixture(ref: string): void {
  const path = resolve(SEEDS_ROOT, `${ref}.json`);
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as SeedFixture;

  const db = createDb(':memory:');
  const seeded = seedFixture(new CommandExecutor(db), fixture);
  const slice = queryGraph(db, seeded.specId);

  console.log(`✓ ${ref} is structurally legal`);
  console.log(`  authored:       ${fixture.nodes.length} nodes, ${fixture.edges.length} edges`);
  console.log(`  stored:         ${seeded.nodeCount} nodes, ${seeded.edgeCount} edges`);
  console.log(`  active-context: ${slice.nodes.length} nodes, ${slice.edges.length} edges`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ref = process.argv[2];
  if (!ref) {
    console.error('usage: tsx src/graph/validate-fixture.ts <set>/<slug>');
    process.exit(2);
  }
  try {
    validateFixture(ref);
  } catch (error: unknown) {
    console.error(`✗ ${ref} is NOT structurally legal:\n`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
