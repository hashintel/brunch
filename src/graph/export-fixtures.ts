/**
 * Export a persisted Brunch spec graph back into the consolidated seed-fixture
 * contract consumed by `seed-fixtures.ts`.
 *
 * This is a dev curation tool: use it after manually refining a local SQLite
 * workspace so the curated graph can become reusable fixture truth.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { eq } from 'drizzle-orm';

import { createDb, type BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { queryGraph, type GraphVisibility } from './queries.js';
import type { SeedFixture, SeedFixtureEdge, SeedFixtureNode } from './seed-fixtures.js';

export interface ExportSeedFixtureInput {
  readonly specId: number;
  /**
   * Defaults to all graph truth so captured fixtures preserve any superseded
   * predecessors that remain in accepted graph history.
   */
  readonly show?: GraphVisibility;
}

export function exportSeedFixtureFromWorkspace(
  workspace: string,
  input: ExportSeedFixtureInput,
): SeedFixture {
  const db = createDb(join(resolve(workspace), '.brunch', 'data.db'));
  return exportSeedFixture(db, input);
}

export function exportSeedFixture(db: BrunchDb, input: ExportSeedFixtureInput): SeedFixture {
  const spec = db.select().from(schema.specs).where(eq(schema.specs.id, input.specId)).get();
  if (!spec) throw new Error(`exportSeedFixture: spec ${input.specId} does not exist`);

  const overview = queryGraph(db, input.specId, undefined, { visibility: input.show ?? 'all' });
  const orderedNodes = [...overview.nodes].sort((a, b) => a.id - b.id);
  const localIdByNodeId = new Map(orderedNodes.map((node, index) => [node.id, index + 1]));

  const nodes: SeedFixtureNode[] = orderedNodes.map((node, index) => ({
    local_id: index + 1,
    plane: node.plane,
    kind: node.kind,
    title: node.title,
    body: node.body ?? null,
    basis: node.basis,
    settlement: node.settlement,
    source: node.source ?? null,
    detail: node.detail ?? null,
  }));

  const edges: SeedFixtureEdge[] = [...overview.edges]
    .sort((a, b) => a.id - b.id)
    .map((edge) => {
      const sourceLocalId = localIdByNodeId.get(edge.sourceId);
      const targetLocalId = localIdByNodeId.get(edge.targetId);
      if (sourceLocalId == null || targetLocalId == null) {
        throw new Error(
          `exportSeedFixture: edge ${edge.id} references a node outside the ${input.show ?? 'all'} visibility`,
        );
      }
      return {
        category: edge.category,
        source_local_id: sourceLocalId,
        target_local_id: targetLocalId,
        stance: edge.stance ?? null,
        basis: edge.basis,
        settlement: edge.settlement,
        rationale: edge.rationale ?? null,
      };
    });

  return {
    spec: {
      slug: spec.slug,
      name: spec.name,
      kind: spec.kind,
    },
    nodes,
    edges,
  };
}

export function formatSeedFixture(fixture: SeedFixture): string {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

interface CliArgs {
  readonly workspace: string;
  readonly specId: number;
  readonly out?: string;
  readonly show?: GraphVisibility;
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  let workspace = process.cwd();
  let specId: number | undefined;
  let out: string | undefined;
  let show: GraphVisibility | undefined;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg == null) throw new Error(`missing argument at index ${index}`);
    if (arg === '--workspace' || arg === '-w') {
      workspace = requiredValue(argv, ++index, arg);
    } else if (arg === '--spec-id') {
      specId = parsePositiveInt(requiredValue(argv, ++index, arg), arg);
    } else if (arg === '--out' || arg === '-o') {
      out = requiredValue(argv, ++index, arg);
    } else if (arg === '--show') {
      const value = requiredValue(argv, ++index, arg);
      if (value !== 'all' && value !== 'active') {
        throw new Error('--show must be all or active');
      }
      show = value;
    } else if (arg === '--help' || arg === '-h') {
      throw new UsageRequested();
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (specId == null) throw new Error('--spec-id is required');
  return {
    workspace,
    specId,
    ...(out === undefined ? {} : { out }),
    ...(show === undefined ? {} : { show }),
  };
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function parsePositiveInt(value: string, flag: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${flag} must be a positive integer`);
  return Number(value);
}

class UsageRequested extends Error {}

function usage(): string {
  return [
    'Usage:',
    '  tsx src/graph/export-fixtures.ts --workspace <dir> --spec-id <id> --out <file>',
    '',
    'Options:',
    '  -w, --workspace <dir>       Brunch workspace directory (default: cwd)',
    '      --spec-id <id>          Spec id to capture',
    '  -o, --out <file>            Output fixture JSON path (default: stdout)',
    '      --show <name>           all | active (default: all)',
  ].join('\n');
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const fixture = exportSeedFixtureFromWorkspace(args.workspace, {
    specId: args.specId,
    ...(args.show === undefined ? {} : { show: args.show }),
  });
  const rendered = formatSeedFixture(fixture);

  if (args.out) {
    const outPath = resolve(args.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, rendered, 'utf8');
    console.log(`wrote ${outPath}`);
  } else {
    process.stdout.write(rendered);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    if (error instanceof UsageRequested) {
      console.log(usage());
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${usage()}`);
    process.exit(1);
  });
}
