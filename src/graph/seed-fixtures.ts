/**
 * Seed loader for consolidated fixture specs.
 *
 * Reads the brunch-shaped seed contract produced under
 * `.fixtures/seeds/<set>/<slug>.json` and commits each spec into a brunch
 * SQLite database through the normal `CommandExecutor` mutation boundary, so
 * the graph clock, change log, and `*_lsn` columns stay coherent — seeded
 * data is indistinguishable from data an agent would have committed live.
 *
 * Lives in `graph/` (not `db/`) because it orchestrates the graph command
 * layer: `db/` is imported only by `graph/`, never the reverse (see
 * `src/db/README.md`). This mirrors `workspace-store.ts`, which likewise
 * wires `createDb` + `CommandExecutor`.
 *
 * The fixture-prep step that *produces* these files (porting Bilal's
 * spec-elicitation graphs) is a separate throwaway script vendored next to
 * the data at `.fixtures/seeds/bilal-port/_port-script.ts`; this loader only
 * consumes the consolidated `<slug>.json` output and is unaware of any
 * upstream format.
 *
 * CLI (dev only, run via tsx):
 *   npm run seed                      # seed all sets into <cwd>/.brunch/data.db
 *   tsx src/graph/seed-fixtures.ts    # same
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BatchEdgeInput, BatchNodeInput, ReadinessGrade } from './command-executor.js';
import { CommandExecutor } from './command-executor.js';
import type { EdgeCategory, EdgeStance } from './schema/edges.js';
import type { NodeBasis, NodePlane } from './schema/nodes.js';
import { openWorkspaceCommandExecutor } from './workspace-store.js';

// ---------------------------------------------------------------------------
// Seed contract — shape of a consolidated `<slug>.json` fixture
// ---------------------------------------------------------------------------

/** Spec header of a consolidated fixture. */
export interface SeedFixtureSpec {
  readonly slug: string;
  readonly name: string;
  readonly readiness_grade: ReadinessGrade;
}

/** A node row in a consolidated fixture; `local_id` is referenced by edges. */
export interface SeedFixtureNode {
  readonly local_id: number;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly title: string;
  readonly body?: string | null;
  readonly basis?: NodeBasis;
  readonly source?: string | null;
  readonly detail?: unknown;
}

/** An edge row in a consolidated fixture; endpoints reference node `local_id`s. */
export interface SeedFixtureEdge {
  readonly category: EdgeCategory;
  readonly source_local_id: number;
  readonly target_local_id: number;
  readonly stance?: EdgeStance | null;
  readonly basis?: NodeBasis;
  readonly rationale?: string | null;
}

/** A consolidated fixture: one spec plus its graph, the atomic seed unit. */
export interface SeedFixture {
  readonly spec: SeedFixtureSpec;
  readonly nodes: readonly SeedFixtureNode[];
  readonly edges: readonly SeedFixtureEdge[];
}

/** Outcome of seeding one fixture. */
export interface SeedResult {
  readonly slug: string;
  readonly specId: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Seed one consolidated fixture into the graph via `CommandExecutor`.
 *
 * Creates the spec, then commits all nodes and edges in a single
 * `commitGraph` batch (edges reference nodes by stringified `local_id`).
 * The batch basis is `explicit`; fixtures carrying any other basis are
 * rejected rather than silently mis-seeded — the multi-basis case would
 * require splitting into per-basis node batches with cross-batch edge refs,
 * which no current fixture needs.
 *
 * Throws on any structural rejection from the command layer.
 */
export function seedFixture(executor: CommandExecutor, fixture: SeedFixture): SeedResult {
  const offBasis = [...fixture.nodes, ...fixture.edges].find(
    (item) => item.basis != null && item.basis !== 'explicit',
  );
  if (offBasis) {
    throw new Error(
      `seedFixture: only "explicit" basis fixtures are supported; "${fixture.spec.slug}" ` +
        `contains basis "${String(offBasis.basis)}"`,
    );
  }

  const specResult = executor.createSpec({
    name: fixture.spec.name,
    slug: fixture.spec.slug,
    readinessGrade: fixture.spec.readiness_grade,
  });
  if (specResult.status !== 'success') {
    throw new Error(
      `seedFixture: createSpec failed for "${fixture.spec.slug}": ${JSON.stringify(specResult.diagnostics)}`,
    );
  }

  const nodes: BatchNodeInput[] = fixture.nodes.map((node) => ({
    ref: String(node.local_id),
    plane: node.plane,
    kind: node.kind,
    title: node.title,
    body: node.body ?? undefined,
    source: node.source ?? undefined,
    detail: node.detail ?? undefined,
  }));

  const edges: BatchEdgeInput[] = fixture.edges.map((edge) => ({
    category: edge.category,
    source: String(edge.source_local_id),
    target: String(edge.target_local_id),
    stance: edge.stance ?? undefined,
    rationale: edge.rationale ?? undefined,
  }));

  const result = executor.commitGraph({ specId: specResult.specId, basis: 'explicit', nodes, edges });
  if (result.status !== 'success') {
    throw new Error(
      `seedFixture: commitGraph failed for "${fixture.spec.slug}": ${JSON.stringify(result.diagnostics)}`,
    );
  }

  return {
    slug: fixture.spec.slug,
    specId: specResult.specId,
    nodeCount: Object.keys(result.createdNodes).length,
    edgeCount: result.edges.length,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SEEDS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../.fixtures/seeds');

/** Read every `<slug>.json` (ignoring `_`-prefixed files) under a seed-set dir. */
async function readSeedSet(setDir: string): Promise<SeedFixture[]> {
  const entries = await readdir(setDir);
  const files = entries.filter((name) => name.endsWith('.json') && !name.startsWith('_')).sort();
  const fixtures: SeedFixture[] = [];
  for (const file of files) {
    const raw = await readFile(join(setDir, file), 'utf8');
    fixtures.push(JSON.parse(raw) as SeedFixture);
  }
  return fixtures;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const sets = await readdir(SEEDS_ROOT, { withFileTypes: true });
  const setDirs = sets.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const executor = await openWorkspaceCommandExecutor(cwd);
  for (const set of setDirs) {
    const fixtures = await readSeedSet(join(SEEDS_ROOT, set));
    for (const fixture of fixtures) {
      const result = seedFixture(executor, fixture);
      console.log(
        `seeded ${set}/${result.slug} → spec ${result.specId} ` +
          `(${result.nodeCount} nodes, ${result.edgeCount} edges)`,
      );
    }
  }
  console.log(`\nDone. Seeded into ${join(cwd, '.brunch', 'data.db')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
