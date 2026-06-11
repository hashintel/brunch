/**
 * seedFixture tests — proves a vendored consolidated fixture loads through
 * the CommandExecutor mutation boundary into a real (in-memory) brunch DB,
 * keeping the graph clock and change log coherent.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { changeLog, edges, graphClock, nodes, specs } from '../db/schema.js';
import { CommandExecutor } from './command-executor.js';
import { EDGE_CATEGORIES } from './schema/kinds.js';
import { NODE_KIND_METADATA, type ReadinessBand } from './schema/nodes.js';
import { runSeedFixturesCli, seedFixture, type SeedFixture } from './seed-fixtures.js';
import { openWorkspaceCommandExecutor } from './workspace-store.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadFixture(slug: string, set = 'bilal-port'): SeedFixture {
  const path = resolve(HERE, `../../.fixtures/seeds/${set}/${slug}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as SeedFixture;
}

function graphClockLsn(db: BrunchDb, specId: number): number {
  return (
    db.select({ lsn: graphClock.lsn }).from(graphClock).where(eq(graphClock.spec_id, specId)).get()?.lsn ?? 0
  );
}

describe('seed fixture CLI', () => {
  it.each([
    { name: 'missing args', argv: [] },
    { name: 'missing workspace value', argv: ['--workspace', '--seed', 'workspace-spread/alpha-grounding'] },
    { name: 'missing seed value', argv: ['--workspace', 'target', '--seed'] },
    {
      name: 'unknown arg',
      argv: ['--workspace', 'target', '--seed', 'workspace-spread/alpha-grounding', '--extra'],
    },
    {
      name: 'duplicate workspace flag',
      argv: ['--workspace', 'one', '--workspace', 'two', '--seed', 'workspace-spread/alpha-grounding'],
    },
    {
      name: 'duplicate seed flag',
      argv: [
        '--workspace',
        'target',
        '--seed',
        'workspace-spread/alpha-grounding',
        '--seed',
        'yamlbase/spec-graph',
      ],
    },
    {
      name: 'parent seed set',
      argv: ['--workspace', 'target', '--seed', '../workspace-spread/alpha-grounding'],
    },
    {
      name: 'parent seed slug',
      argv: ['--workspace', 'target', '--seed', 'workspace-spread/../alpha-grounding'],
    },
    {
      name: 'absolute seed ref',
      argv: ['--workspace', 'target', '--seed', '/workspace-spread/alpha-grounding'],
    },
  ])('rejects malformed input without creating a cwd DB: $name', async ({ argv }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-seed-cwd-'));
    let stderr = '';

    const code = await runSeedFixturesCli({
      argv,
      cwd,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('Usage: npm run seed -- --workspace <dir> --seed <set>/<slug>');
    expect(existsSync(join(cwd, '.brunch', 'data.db'))).toBe(false);
  });

  it('accepts equals-form flags when values are unambiguous and safe', async () => {
    const shellCwd = await mkdtemp(join(tmpdir(), 'brunch-seed-shell-'));
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: [`--workspace=${targetWorkspace}`, '--seed=workspace-spread/alpha-grounding'],
      cwd: shellCwd,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded workspace-spread/alpha-grounding → spec');
    expect(existsSync(join(shellCwd, '.brunch', 'data.db'))).toBe(false);
    expect(existsSync(join(targetWorkspace, '.brunch', 'data.db'))).toBe(true);
  });

  it('reports the selected seed ref rather than the fixture internal spec slug', async () => {
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'yamlbase/spec-graph'],
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded yamlbase/spec-graph → spec');
    expect(stdout).not.toContain('seeded yamlbase/yamlbase → spec');
  });

  it('seeds only the selected fixture into the named workspace and reports the destination DB', async () => {
    const shellCwd = await mkdtemp(join(tmpdir(), 'brunch-seed-shell-'));
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'workspace-spread/alpha-grounding'],
      cwd: shellCwd,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded workspace-spread/alpha-grounding → spec');
    expect(stdout).toContain(`Destination: ${join(targetWorkspace, '.brunch', 'data.db')}`);
    expect(existsSync(join(shellCwd, '.brunch', 'data.db'))).toBe(false);
    expect(existsSync(join(targetWorkspace, '.brunch', 'data.db'))).toBe(true);

    const executor = await openWorkspaceCommandExecutor(targetWorkspace);
    const specRows = executor.listSpecs();
    expect(specRows.map((spec) => spec.slug)).toEqual(['alpha-grounding']);
    const alpha = specRows[0]!;
    const db = createDb(join(targetWorkspace, '.brunch', 'data.db'));
    expect(db.select().from(nodes).where(eq(nodes.spec_id, alpha.id)).all()).toHaveLength(
      loadFixture('alpha-grounding', 'workspace-spread').nodes.length,
    );
    expect(
      db
        .select({ operation: changeLog.operation })
        .from(changeLog)
        .where(eq(changeLog.spec_id, alpha.id))
        .all()
        .map((row) => row.operation),
    ).toEqual(['create_spec', 'mutate_graph']);
  });
});

describe('seedFixture', () => {
  it('seeds the code-health fixture into a real DB via the command layer', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('code-health');

    const result = seedFixture(executor, fixture);

    // Reported counts match the fixture.
    expect(result.nodeCount).toBe(fixture.nodes.length);
    expect(result.edgeCount).toBe(fixture.edges.length);

    // Exactly one spec row, with the fixture's identity.
    const specRows = db.select().from(specs).all();
    expect(specRows).toHaveLength(1);
    expect(specRows[0]!.id).toBe(result.specId);
    expect(specRows[0]!.slug).toBe('code-health');

    // Node / edge rows persisted, all scoped to the seeded spec.
    const nodeRows = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();
    const edgeRows = db.select().from(edges).where(eq(edges.spec_id, result.specId)).all();
    expect(nodeRows).toHaveLength(fixture.nodes.length);
    expect(edgeRows).toHaveLength(fixture.edges.length);
    expect(nodeRows.every((row) => row.basis === 'explicit')).toBe(true);

    // Graph clock advanced once per command for this spec: createSpec + mutateGraph = lsn 2.
    expect(graphClockLsn(db, result.specId)).toBe(2);

    // Change log records both mutations in order for this spec.
    const logs = db.select().from(changeLog).all();
    expect(logs.map((row) => [row.spec_id, row.operation])).toEqual([
      [result.specId, 'create_spec'],
      [result.specId, 'mutate_graph'],
    ]);
  });

  it('loads the macro-view grounded-intent variant as explicit intent-only seed truth', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('macro-view-grounded-intent', 'bilal-port-variants');

    expect(fixture.nodes.length).toBeGreaterThan(0);
    expect(fixture.nodes.every((node) => node.plane === 'intent')).toBe(true);
    expect(fixture.nodes.every((node) => node.basis === 'explicit')).toBe(true);
    expect(fixture.edges.every((edge) => edge.basis === 'explicit')).toBe(true);

    const result = seedFixture(executor, fixture);

    const nodeRows = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();
    const edgeRows = db.select().from(edges).where(eq(edges.spec_id, result.specId)).all();
    expect(nodeRows).toHaveLength(fixture.nodes.length);
    expect(edgeRows).toHaveLength(fixture.edges.length);
    expect(nodeRows.every((row) => row.plane === 'intent' && row.basis === 'explicit')).toBe(true);
  });

  it('loads the kind-band spread fixture with every node kind and all readiness bands represented', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('coverage-matrix', 'kind-band-spread');

    const result = seedFixture(executor, fixture);
    const nodeRows = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();

    expect(new Set(nodeRows.map((row) => row.kind))).toEqual(new Set(Object.keys(NODE_KIND_METADATA)));
    expect(new Set(readinessBandsFor(nodeRows.map((row) => row.kind)))).toEqual(
      new Set<ReadinessBand>(['grounding', 'elicitation', 'commitment']),
    );
  });

  it('loads the edge-spread fixture with every edge category and a thesis absence case', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('category-directions', 'edge-spread');

    const result = seedFixture(executor, fixture);
    const specEdges = db.select().from(edges).where(eq(edges.spec_id, result.specId)).all();
    const specNodes = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();
    const thesisId = specNodes.find((row) => row.title === 'Unproven thesis exemplar')?.id;

    expect(new Set(specEdges.map((row) => row.category))).toEqual(new Set(EDGE_CATEGORIES));
    expect(thesisId).toBeDefined();
    expect(specEdges.some((row) => row.category === 'proof' && row.target_id === thesisId)).toBe(false);
  });

  it('loads the workspace-spread fixtures into one DB with distinct slugs', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const alpha = seedFixture(executor, loadFixture('alpha-grounding', 'workspace-spread'));
    const beta = seedFixture(executor, loadFixture('beta-commitments', 'workspace-spread'));

    const specRows = db.select({ slug: specs.slug }).from(specs).all();

    expect(specRows).toEqual([{ slug: 'alpha-grounding' }, { slug: 'beta-commitments' }]);
    expect(graphClockLsn(db, alpha.specId)).toBe(2);
    expect(graphClockLsn(db, beta.specId)).toBe(2);
  });

  it('keeps seeded spec LSNs coherent independent of seed order', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const first = seedFixture(executor, loadFixture('code-health'));
    const second = seedFixture(executor, loadFixture('macro-view-grounded-intent', 'bilal-port-variants'));

    expect(graphClockLsn(db, first.specId)).toBe(2);
    expect(graphClockLsn(db, second.specId)).toBe(2);
    expect(
      db
        .select({ specId: changeLog.spec_id, lsn: changeLog.lsn, operation: changeLog.operation })
        .from(changeLog)
        .all(),
    ).toEqual([
      { specId: first.specId, lsn: 1, operation: 'create_spec' },
      { specId: first.specId, lsn: 2, operation: 'mutate_graph' },
      { specId: second.specId, lsn: 1, operation: 'create_spec' },
      { specId: second.specId, lsn: 2, operation: 'mutate_graph' },
    ]);
  });

  it('rejects fixtures carrying a non-explicit basis', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture: SeedFixture = {
      spec: { slug: 'off-basis', name: 'Off Basis' },
      nodes: [{ local_id: 1, plane: 'intent', kind: 'goal', title: 'A goal', basis: 'implicit' }],
      edges: [],
    };

    expect(() => seedFixture(executor, fixture)).toThrow(/only "explicit" basis/);
  });
});

function readinessBandsFor(kinds: string[]): ReadinessBand[] {
  return kinds.flatMap((kind) => NODE_KIND_METADATA[kind as keyof typeof NODE_KIND_METADATA].readinessBands);
}
