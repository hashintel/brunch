/**
 * seedFixture tests — proves a vendored consolidated fixture loads through
 * the CommandExecutor mutation boundary into a real (in-memory) brunch DB,
 * keeping the graph clock and change log coherent.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { changeLog, edges, graphClock, nodes, specs } from '../db/schema.js';
import { CommandExecutor } from './command-executor.js';
import { seedFixture, type SeedFixture } from './seed-fixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadFixture(slug: string, set = 'bilal-port'): SeedFixture {
  const path = resolve(HERE, `../../.fixtures/seeds/${set}/${slug}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as SeedFixture;
}

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
    expect(specRows[0]!.readiness_grade).toBe('commitments_ready');

    // Node / edge rows persisted, all scoped to the seeded spec.
    const nodeRows = db.select().from(nodes).where(eq(nodes.spec_id, result.specId)).all();
    const edgeRows = db.select().from(edges).where(eq(edges.spec_id, result.specId)).all();
    expect(nodeRows).toHaveLength(fixture.nodes.length);
    expect(edgeRows).toHaveLength(fixture.edges.length);
    expect(nodeRows.every((row) => row.basis === 'explicit')).toBe(true);

    // Graph clock advanced once per command: createSpec + commitGraph = lsn 2.
    expect(db.select().from(graphClock).get()!.lsn).toBe(2);

    // Change log records both mutations in order.
    const ops = db
      .select()
      .from(changeLog)
      .all()
      .map((row) => row.operation);
    expect(ops).toEqual(['create_spec', 'commit_graph']);
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

  it('rejects fixtures carrying a non-explicit basis', () => {
    const db: BrunchDb = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const fixture: SeedFixture = {
      spec: { slug: 'off-basis', name: 'Off Basis', readiness_grade: 'grounding_onboarding' },
      nodes: [{ local_id: 1, plane: 'intent', kind: 'goal', title: 'A goal', basis: 'implicit' }],
      edges: [],
    };

    expect(() => seedFixture(executor, fixture)).toThrow(/only "explicit" basis/);
  });
});
