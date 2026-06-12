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
 *   npm run seed -- --workspace <dir> --seed <set>/<slug> [--reset]
 *
 * `--reset` deletes the target workspace's **runtime state** before seeding
 * — `.brunch/data.db` (plus `-wal`/`-shm`), the `.brunch/sessions/` and
 * `.brunch/debug/` directories, and `.brunch/workspace.json` — so "fresh
 * workbench from one named seed" is a single command and a relaunch takes
 * the new-session path (seed + kick) instead of resuming a stale session
 * whose spec ids point at the deleted DB. Only those named artifacts are
 * removed: never the `.brunch/` directory itself, and never unknown files
 * inside it.
 */

import { readFile, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GraphMutationOp } from './command-executor.js';
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
 * Creates the spec, then mutates all nodes and edges in a single
 * `mutateGraph` batch (edges reference nodes by stringified `local_id`).
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
  });
  if (specResult.status !== 'success') {
    throw new Error(
      `seedFixture: createSpec failed for "${fixture.spec.slug}": ${JSON.stringify(specResult.diagnostics)}`,
    );
  }

  const ops: GraphMutationOp[] = [
    ...fixture.nodes.map(
      (node) =>
        ({
          op: 'create_node',
          ref: String(node.local_id),
          plane: node.plane,
          kind: node.kind,
          title: node.title,
          body: node.body ?? undefined,
          source: node.source ?? undefined,
          detail: node.detail ?? undefined,
        }) satisfies GraphMutationOp,
    ),
    ...fixture.edges.map((edge) => roleNamedSeedEdgeDraft(edge)),
  ];

  const result = executor.mutateGraph({ specId: specResult.specId, createBasis: 'explicit', ops });
  if (result.status !== 'success') {
    throw new Error(
      `seedFixture: mutateGraph failed for "${fixture.spec.slug}": ${JSON.stringify(result.diagnostics)}`,
    );
  }

  return {
    slug: fixture.spec.slug,
    specId: specResult.specId,
    nodeCount: Object.keys(result.createdNodes).length,
    edgeCount: result.createdEdges.length,
  };
}

function roleNamedSeedEdgeDraft(
  edge: SeedFixtureEdge,
): Extract<GraphMutationOp, { readonly op: 'create_edge' }> {
  switch (edge.category) {
    case 'dependency':
      return {
        op: 'create_edge',
        category: 'dependency',
        dependency: String(edge.source_local_id),
        dependent: String(edge.target_local_id),
        rationale: edge.rationale ?? undefined,
      };
    case 'proof':
      return {
        op: 'create_edge',
        category: 'proof',
        oracle: String(edge.source_local_id),
        claim: String(edge.target_local_id),
        stance: edge.stance ?? 'for',
        rationale: edge.rationale ?? undefined,
      };
    case 'support':
      return {
        op: 'create_edge',
        category: 'support',
        support: String(edge.source_local_id),
        claim: String(edge.target_local_id),
        stance: edge.stance ?? 'for',
        rationale: edge.rationale ?? undefined,
      };
    case 'realization':
      return {
        op: 'create_edge',
        category: 'realization',
        abstract: String(edge.source_local_id),
        concrete: String(edge.target_local_id),
        rationale: edge.rationale ?? undefined,
      };
    case 'boundary':
      return {
        op: 'create_edge',
        category: 'boundary',
        boundary: String(edge.source_local_id),
        subject: String(edge.target_local_id),
        rationale: edge.rationale ?? undefined,
      };
    case 'composition':
      return {
        op: 'create_edge',
        category: 'composition',
        whole: String(edge.source_local_id),
        part: String(edge.target_local_id),
        rationale: edge.rationale ?? undefined,
      };
    case 'association':
      return {
        op: 'create_edge',
        category: 'association',
        a: String(edge.source_local_id),
        b: String(edge.target_local_id),
        rationale: edge.rationale ?? undefined,
      };
    case 'supersession':
      return {
        op: 'create_edge',
        category: 'supersession',
        successor: String(edge.source_local_id),
        predecessor: String(edge.target_local_id),
        rationale: edge.rationale ?? undefined,
      };
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SEEDS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../.fixtures/seeds');

interface SeedCliOptions {
  readonly argv?: readonly string[];
  readonly cwd?: string;
  readonly stdout?: (chunk: string) => void;
  readonly stderr?: (chunk: string) => void;
}

interface ParsedSeedCliArgs {
  readonly workspace: string;
  readonly reset: boolean;
  readonly seed: {
    readonly ref: string;
    readonly set: string;
    readonly slug: string;
  };
}

/**
 * Workspace runtime state removed by `--reset`: the DB files, the sessions
 * and debug directories, and the selection-state file. A closed, literal
 * list — unknown files under `.brunch/` are not ours to delete, and the
 * `.brunch/` directory itself always survives.
 */
function workspaceRuntimeState(workspace: string): {
  readonly files: readonly string[];
  readonly directories: readonly string[];
} {
  const brunchDir = join(workspace, '.brunch');
  const dbPath = join(brunchDir, 'data.db');
  return {
    files: [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, join(brunchDir, 'workspace.json')],
    directories: [join(brunchDir, 'sessions'), join(brunchDir, 'debug')],
  };
}

/** Read one `<slug>.json` fixture under a seed-set dir. */
async function readSelectedSeed(set: string, slug: string): Promise<SeedFixture> {
  const raw = await readFile(join(SEEDS_ROOT, set, `${slug}.json`), 'utf8');
  return JSON.parse(raw) as SeedFixture;
}

export async function runSeedFixturesCli(options: SeedCliOptions = {}): Promise<number> {
  const stdout = options.stdout ?? ((chunk) => process.stdout.write(chunk));
  const stderr = options.stderr ?? ((chunk) => process.stderr.write(chunk));
  const parsed = parseSeedCliArgs(options.argv ?? process.argv.slice(2), options.cwd ?? process.cwd());
  if (!parsed) {
    stderr(seedUsage());
    return 1;
  }

  try {
    const destinationDb = join(parsed.workspace, '.brunch', 'data.db');
    const fixture = await readSelectedSeed(parsed.seed.set, parsed.seed.slug);
    if (parsed.reset) {
      const runtimeState = workspaceRuntimeState(parsed.workspace);
      for (const file of runtimeState.files) {
        await rm(file, { force: true });
      }
      for (const directory of runtimeState.directories) {
        await rm(directory, { recursive: true, force: true });
      }
    }
    const executor = await openWorkspaceCommandExecutor(parsed.workspace);
    const result = seedFixture(executor, fixture);
    stdout(
      `seeded ${parsed.seed.ref} → spec ${result.specId} ` +
        `(${result.nodeCount} nodes, ${result.edgeCount} edges)\n`,
    );
    stdout(`Destination: ${destinationDb}\n`);
    return 0;
  } catch (error) {
    stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function parseSeedCliArgs(argv: readonly string[], cwd: string): ParsedSeedCliArgs | null {
  const values = new Map<string, string>();
  let reset = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--reset') {
      if (reset) return null;
      reset = true;
      continue;
    }
    if (arg === '--workspace' || arg === '--seed') {
      const value = argv[index + 1];
      if (!safeFlagValue(value) || values.has(arg)) return null;
      values.set(arg, value);
      index += 1;
      continue;
    }

    const equals = arg.match(/^(--workspace|--seed)=(.*)$/u);
    if (equals) {
      const flag = equals[1] as '--workspace' | '--seed';
      const value = equals[2];
      if (!safeFlagValue(value) || values.has(flag)) return null;
      values.set(flag, value);
      continue;
    }

    return null;
  }

  const workspace = values.get('--workspace');
  const seed = values.get('--seed');
  if (!workspace || !seed) return null;

  const [set, slug, extra] = seed.split('/');
  if (!safeSeedPart(set) || !safeSeedPart(slug) || extra) return null;

  return {
    workspace: isAbsolute(workspace) ? workspace : resolve(cwd, workspace),
    reset,
    seed: { ref: seed, set, slug },
  };
}

function safeFlagValue(value: string | undefined): value is string {
  return value != null && value.length > 0 && !value.startsWith('--');
}

function safeSeedPart(value: string | undefined): value is string {
  return value != null && /^[a-z0-9][a-z0-9-]*$/u.test(value);
}

function seedUsage(): string {
  return (
    'Usage: npm run seed -- --workspace <dir> --seed <set>/<slug> [--reset]\n' +
    '  --reset  delete the target workspace .brunch/data.db (+ -wal/-shm) before seeding\n'
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeedFixturesCli().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
