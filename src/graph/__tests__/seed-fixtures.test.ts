/**
 * seedFixture tests — proves a vendored consolidated fixture loads through
 * the CommandExecutor mutation boundary into a real (in-memory) brunch DB,
 * keeping the graph clock and change log coherent.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { changeLog, edges, elicitationGaps, graphClock, nodes, specs } from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import { GROUNDING_FLOOR_KINDS } from '../schema/elicitation-gap-fixtures.js';
import { EDGE_CATEGORIES, type ReadinessBand } from '../schema/kinds.js';
import { NODE_KIND_METADATA, latestExpectedBand } from '../schema/nodes.js';
import {
  parseSeedRef,
  runSeedFixturesCli,
  seedFixture,
  type SeedFixture,
  workbenchPathForSeed,
} from '../seed-fixtures.js';
import { openWorkspaceCommandExecutor } from '../workspace-store.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string, variant = 'base'): SeedFixture {
  const path = resolve(HERE, `../../../.fixtures/seeds/${name}/${variant}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as SeedFixture;
}

function graphClockLsn(db: BrunchDb, specId: number): number {
  return (
    db.select({ lsn: graphClock.lsn }).from(graphClock).where(eq(graphClock.spec_id, specId)).get()?.lsn ?? 0
  );
}

function trackedSeedRefs(): string[] {
  const seedsRoot = resolve(HERE, '../../../.fixtures/seeds');
  return readdirSync(seedsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((name) =>
      readdirSync(join(seedsRoot, name.name))
        .filter((file) => file.endsWith('.json'))
        .map((file) => `${name.name}/${file.slice(0, -'.json'.length)}`),
    )
    .sort();
}

describe('seed fixture CLI', () => {
  it.each([
    { name: 'missing args', argv: [] },
    { name: 'missing workspace value', argv: ['--workspace', '--seed', 'workspace-alpha-grounding/base'] },
    { name: 'missing seed value', argv: ['--workspace', 'target', '--seed'] },
    {
      name: 'unknown arg',
      argv: ['--workspace', 'target', '--seed', 'workspace-alpha-grounding/base', '--extra'],
    },
    {
      name: 'duplicate workspace flag',
      argv: ['--workspace', 'one', '--workspace', 'two', '--seed', 'workspace-alpha-grounding/base'],
    },
    {
      name: 'duplicate seed flag',
      argv: ['--workspace', 'target', '--seed', 'workspace-alpha-grounding/base', '--seed', 'yamlbase/base'],
    },
    {
      name: 'parent seed family',
      argv: ['--workspace', 'target', '--seed', '../workspace-alpha-grounding/base'],
    },
    {
      name: 'parent seed variant',
      argv: ['--workspace', 'target', '--seed', 'workspace-alpha-grounding/../base'],
    },
    {
      name: 'absolute seed ref',
      argv: ['--workspace', 'target', '--seed', '/workspace-alpha-grounding/base'],
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
    expect(stderr).toContain('Usage: npm run seed -- (--seed <name>/<variant>');
    expect(existsSync(join(cwd, '.brunch', 'data.db'))).toBe(false);
  });

  it('rejects --reset without the required flags and documents it in usage', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-seed-cwd-'));
    let stderr = '';

    const code = await runSeedFixturesCli({
      argv: ['--reset'],
      cwd,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('--reset');
    expect(existsSync(join(cwd, '.brunch', 'data.db'))).toBe(false);
  });

  it('rejects ambiguous single-seed and all-seeds requests', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-seed-cwd-'));
    let stderr = '';

    const code = await runSeedFixturesCli({
      argv: ['--workspace', cwd, '--seed', 'workspace-alpha-grounding/base', '--all-seeds'],
      cwd,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('Usage: npm run seed -- (--seed <name>/<variant>');
    expect(existsSync(join(cwd, '.brunch', 'data.db'))).toBe(false);
  });

  it('requires --workspace for --all-seeds', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-seed-cwd-'));
    let stderr = '';

    const code = await runSeedFixturesCli({
      argv: ['--all-seeds'],
      cwd,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('--all-seeds');
    expect(existsSync(join(cwd, '.brunch', 'data.db'))).toBe(false);
  });

  it('--reset on a fresh workspace with no DB is a no-op and seeds cleanly', async () => {
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'workspace-alpha-grounding/base', '--reset'],
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded workspace-alpha-grounding/base → spec');
    expect(existsSync(join(targetWorkspace, '.brunch', 'data.db'))).toBe(true);
  });

  it('--reset wipes workspace runtime state (DB, sessions, selection state, debug cache) so a relaunch starts fresh', async () => {
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));

    const first = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'workspace-alpha-grounding/base'],
      stdout: () => {},
    });
    expect(first).toBe(0);

    // The walkthrough regression: a stale session JSONL makes the TUI resume
    // (no seed, no kick) instead of starting fresh, and stale workspace.json /
    // debug caches reference the deleted DB. All four runtime artifacts must
    // go; unknown files in .brunch/ are not ours to delete.
    const brunchDir = join(targetWorkspace, '.brunch');
    const sessionsDir = join(brunchDir, 'sessions');
    const debugDir = join(brunchDir, 'debug');
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(join(sessionsDir, 'stale-session.jsonl'), '{"type":"session"}\n', 'utf8');
    await writeFile(join(brunchDir, 'workspace.json'), '{"stale":true}', 'utf8');
    await mkdir(debugDir, { recursive: true });
    await writeFile(join(debugDir, 'entry-contents.md'), 'stale blocks', 'utf8');
    await writeFile(join(brunchDir, 'notes.md'), 'keep me', 'utf8');

    const second = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'workspace-beta-commitments/base', '--reset'],
      stdout: () => {},
    });
    expect(second).toBe(0);

    const executor = await openWorkspaceCommandExecutor(targetWorkspace);
    expect(executor.listSpecs().map((spec) => spec.slug)).toEqual(['workspace-beta-commitments']);
    expect(existsSync(sessionsDir)).toBe(false);
    expect(existsSync(join(brunchDir, 'workspace.json'))).toBe(false);
    expect(existsSync(debugDir)).toBe(false);
    expect(readFileSync(join(brunchDir, 'notes.md'), 'utf8')).toBe('keep me');
  });

  it('maps a seed ref to its derived workbench path under .fixtures/workbenches', () => {
    const seed = parseSeedRef('workspace-alpha-grounding/base');

    expect(seed).not.toBeNull();
    expect(workbenchPathForSeed(seed!)).toBe(
      resolve(HERE, '../../../.fixtures/workbenches/workspace-alpha-grounding'),
    );
  });

  it('accepts equals-form flags when values are unambiguous and safe', async () => {
    const shellCwd = await mkdtemp(join(tmpdir(), 'brunch-seed-shell-'));
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: [`--workspace=${targetWorkspace}`, '--seed=workspace-alpha-grounding/base'],
      cwd: shellCwd,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded workspace-alpha-grounding/base → spec');
    expect(existsSync(join(shellCwd, '.brunch', 'data.db'))).toBe(false);
    expect(existsSync(join(targetWorkspace, '.brunch', 'data.db'))).toBe(true);
  });

  it('accepts equals-form --all-seeds and seeds every tracked fixture into the named workspace', async () => {
    const shellCwd = await mkdtemp(join(tmpdir(), 'brunch-seed-shell-'));
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: [`--workspace=${targetWorkspace}`, '--all-seeds'],
      cwd: shellCwd,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    const expectedRefs = trackedSeedRefs();
    expect(code).toBe(0);
    expect(stdout).toContain(`seeded ${expectedRefs.length} tracked seeds`);
    expect(existsSync(join(shellCwd, '.brunch', 'data.db'))).toBe(false);
    expect(existsSync(join(targetWorkspace, '.brunch', 'data.db'))).toBe(true);

    const executor = await openWorkspaceCommandExecutor(targetWorkspace);
    expect(
      executor
        .listSpecs()
        .map((spec) => spec.slug)
        .sort(),
    ).toEqual(expectedRefs.map((ref) => ref.replace('/', '-')).sort());
  });

  it('reports the selected seed ref rather than the fixture internal spec slug', async () => {
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'yamlbase/base'],
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded yamlbase/base → spec');
    expect(stdout).not.toContain('seeded yamlbase/yamlbase → spec');
  });

  it('seeds only the selected fixture into the named workspace and reports the destination DB', async () => {
    const shellCwd = await mkdtemp(join(tmpdir(), 'brunch-seed-shell-'));
    const targetWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seed-target-'));
    let stdout = '';

    const code = await runSeedFixturesCli({
      argv: ['--workspace', targetWorkspace, '--seed', 'workspace-alpha-grounding/base'],
      cwd: shellCwd,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('seeded workspace-alpha-grounding/base → spec');
    expect(stdout).toContain(`Destination: ${join(targetWorkspace, '.brunch', 'data.db')}`);
    expect(existsSync(join(shellCwd, '.brunch', 'data.db'))).toBe(false);
    expect(existsSync(join(targetWorkspace, '.brunch', 'data.db'))).toBe(true);

    const executor = await openWorkspaceCommandExecutor(targetWorkspace);
    const specRows = executor.listSpecs();
    expect(specRows.map((spec) => spec.slug)).toEqual(['workspace-alpha-grounding']);
    const alpha = specRows[0]!;
    const db = createDb(join(targetWorkspace, '.brunch', 'data.db'));
    expect(db.select().from(nodes).where(eq(nodes.spec_id, alpha.id)).all()).toHaveLength(
      loadFixture('workspace-alpha-grounding').nodes.length,
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

describe('all tracked seeds remain structurally legal', () => {
  // One-level <name>/<variant>.json discovery: prep scripts (_*.ts), READMEs, and
  // raw-material subdirectories (e.g. bilal-port/_originals/) are excluded by
  // construction. No hand-maintained list to drift.
  const seedRefs = trackedSeedRefs();

  it('discovers the tracked seed catalog', () => {
    expect(seedRefs.length).toBeGreaterThan(0);
    expect(seedRefs).toContain('workspace-alpha-grounding/base');
    expect(seedRefs.some((ref) => ref.includes('_originals'))).toBe(false);
  });

  it.each(seedRefs.map((ref) => ({ ref })))('seeds $ref through the command layer', ({ ref }) => {
    const [name, variant] = ref.split('/') as [string, string];
    const fixture = loadFixture(name, variant);
    const db = createDb(':memory:');

    const result = seedFixture(new CommandExecutor(db), fixture);

    expect(result.nodeCount).toBe(fixture.nodes.length);
    expect(result.edgeCount).toBe(fixture.edges.length);

    const gapKinds = new Set(
      db
        .select({ refersTo: elicitationGaps.refers_to })
        .from(elicitationGaps)
        .where(eq(elicitationGaps.spec_id, result.specId))
        .all()
        .map((row) => row.refersTo),
    );
    for (const kind of GROUNDING_FLOOR_KINDS) {
      expect(gapKinds.has(kind)).toBe(true);
    }
  });

  it('documents every tracked seed family in the disposition catalog', () => {
    const catalogPath = resolve(HERE, '../../../.fixtures/seeds/README.md');
    const catalog = readFileSync(catalogPath, 'utf8');
    const allowedDispositions = new Set(['test', 'preview', 'manual workbench', 'probe input', 'parked']);
    const catalogRows = new Map<string, string>();

    for (const line of catalog.split('\n')) {
      const match = line.match(/^\| `([^`]+)` \| ([^|]+) \| .+ \|$/u);
      if (match) catalogRows.set(match[1]!, match[2]!.trim());
    }

    const trackedSets = new Set(seedRefs.map((ref) => ref.split('/')[0]!));
    expect([...catalogRows.keys()].sort()).toEqual([...trackedSets].sort());
    for (const disposition of catalogRows.values()) {
      expect(allowedDispositions.has(disposition)).toBe(true);
    }
  });

  it('surfaces command-layer diagnostics when a fixture is illegal', () => {
    const illegal: SeedFixture = {
      spec: { slug: 'illegal-currency-proof', name: 'Illegal currency proof' },
      nodes: [{ local_id: 1, plane: 'intent', kind: 'not-a-kind', title: 'bad kind' }],
      edges: [],
    };

    expect(() => seedFixture(new CommandExecutor(createDb(':memory:')), illegal)).toThrow(
      /mutateGraph failed for "illegal-currency-proof"/u,
    );
  });
});

describe('seedFixture', () => {
  it('seeds the code-health fixture into a real DB via the command layer', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('bilal-code-health');

    const result = seedFixture(executor, fixture);

    // Reported counts match the fixture.
    expect(result.nodeCount).toBe(fixture.nodes.length);
    expect(result.edgeCount).toBe(fixture.edges.length);

    // Exactly one spec row, with the fixture's identity.
    const specRows = db.select().from(specs).all();
    expect(specRows).toHaveLength(1);
    expect(specRows[0]!.id).toBe(result.specId);
    expect(specRows[0]!.slug).toBe('bilal-code-health');

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
    const fixture = loadFixture('bilal-macro-view', 'grounded-intent');

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

  it('loads the kind-coverage matrix fixture with every node kind and all readiness bands represented', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('kind-coverage-matrix');

    const result = seedFixture(executor, fixture);
    const nodeRows = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();

    expect(new Set(nodeRows.map((row) => row.kind))).toEqual(new Set(Object.keys(NODE_KIND_METADATA)));
    expect(new Set(readinessBandsFor(nodeRows.map((row) => row.kind)))).toEqual(
      new Set<ReadinessBand>(['grounding', 'elicitation', 'projection', 'commitment']),
    );
  });

  it('loads the edge-category-directions fixture with every edge category and a thesis absence case', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture = loadFixture('edge-category-directions');

    const result = seedFixture(executor, fixture);
    const specEdges = db.select().from(edges).where(eq(edges.spec_id, result.specId)).all();
    const specNodes = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();
    const thesisId = specNodes.find((row) => row.title === 'Unproven thesis exemplar')?.id;

    expect(new Set(specEdges.map((row) => row.category))).toEqual(new Set(EDGE_CATEGORIES));
    expect(thesisId).toBeDefined();
    expect(specEdges.some((row) => row.category === 'witness' && row.target_id === thesisId)).toBe(false);
  });

  it('loads the workspace family fixtures into one DB with distinct slugs', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const alpha = seedFixture(executor, loadFixture('workspace-alpha-grounding'));
    const beta = seedFixture(executor, loadFixture('workspace-beta-commitments'));

    const specRows = db.select({ slug: specs.slug }).from(specs).all();

    expect(specRows).toEqual([{ slug: 'workspace-alpha-grounding' }, { slug: 'workspace-beta-commitments' }]);
    expect(graphClockLsn(db, alpha.specId)).toBe(2);
    expect(graphClockLsn(db, beta.specId)).toBe(2);
  });

  it('keeps seeded spec LSNs coherent independent of seed order', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const first = seedFixture(executor, loadFixture('bilal-code-health'));
    const second = seedFixture(executor, loadFixture('bilal-macro-view', 'grounded-intent'));

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
  return kinds
    .map((kind) => latestExpectedBand(kind as keyof typeof NODE_KIND_METADATA))
    .filter((band): band is ReadinessBand => band !== null);
}
