import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { exportSeedFixture, formatSeedFixture } from './export-fixtures.js';
import { seedFixture, type SeedFixture } from './seed-fixtures.js';
import { runCreateOnlyMutation } from './test-support/create-only-mutation.js';

function normalizeFixture(fixture: SeedFixture): SeedFixture {
  return {
    spec: fixture.spec,
    nodes: fixture.nodes.map((node) => ({
      local_id: node.local_id,
      plane: node.plane,
      kind: node.kind,
      title: node.title,
      body: node.body ?? null,
      basis: node.basis ?? 'explicit',
      source: node.source ?? null,
      detail: node.detail ?? null,
    })),
    edges: fixture.edges.map((edge) => ({
      category: edge.category,
      source_local_id: edge.source_local_id,
      target_local_id: edge.target_local_id,
      stance: edge.stance ?? null,
      basis: edge.basis ?? 'explicit',
      rationale: edge.rationale ?? null,
    })),
  };
}

function makeFixture(): SeedFixture {
  return {
    spec: {
      slug: 'curation-export',
      name: 'Curation Export',
      readiness_grade: 'elicitation_ready',
    },
    nodes: [
      {
        local_id: 1,
        plane: 'intent',
        kind: 'goal',
        title: 'Capture curated graph truth.',
        body: 'The persisted graph can be captured back into reusable seed truth.',
        basis: 'explicit',
        source: 'manual-test',
        detail: null,
      },
      {
        local_id: 2,
        plane: 'intent',
        kind: 'term',
        title: 'Curated fixture',
        body: 'A fixture captured after manual refinement.',
        basis: 'explicit',
        source: 'manual-test',
        detail: { definition: 'A DB-backed graph exported as seed JSON.', aliases: ['reference fixture'] },
      },
    ],
    edges: [
      {
        category: 'support',
        source_local_id: 2,
        target_local_id: 1,
        stance: 'for',
        basis: 'explicit',
        rationale: 'The term explains the goal.',
      },
    ],
  };
}

function seed(db: BrunchDb, fixture: SeedFixture): number {
  const result = seedFixture(new CommandExecutor(db), fixture);
  return result.specId;
}

describe('exportSeedFixture', () => {
  it('captures a persisted spec back into the consolidated seed contract', () => {
    const db = createDb(':memory:');
    const fixture = makeFixture();
    const specId = seed(db, fixture);

    expect(exportSeedFixture(db, { specId })).toEqual(normalizeFixture(fixture));
  });

  it('defaults to graph truth so superseded predecessors remain capturable', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const created = executor.createSpec({
      slug: 'supersession-capture',
      name: 'Supersession Capture',
      readinessGrade: 'elicitation_ready',
    });
    expect(created.status).toBe('success');
    if (created.status !== 'success') return;

    const committed = runCreateOnlyMutation(executor, {
      specId: created.specId,
      basis: 'explicit',
      nodes: [
        { ref: 'old', plane: 'intent', kind: 'requirement', title: 'Old requirement' },
        { ref: 'new', plane: 'intent', kind: 'requirement', title: 'New requirement' },
      ],
      edges: [{ category: 'supersession', source: 'new', target: 'old' }],
    });
    expect(committed.status).toBe('success');

    const graphTruth = exportSeedFixture(db, { specId: created.specId });
    const activeContext = exportSeedFixture(db, { specId: created.specId, show: 'active' });

    expect(graphTruth.nodes.map((node) => node.title)).toEqual(['Old requirement', 'New requirement']);
    expect(graphTruth.edges).toHaveLength(1);
    expect(activeContext.nodes.map((node) => node.title)).toEqual(['New requirement']);
    expect(activeContext.edges).toHaveLength(0);
  });

  it('renders deterministic newline-terminated JSON', () => {
    const rendered = formatSeedFixture(makeFixture());

    expect(rendered).toMatch(/^\{\n  "spec": \{/);
    expect(rendered.endsWith('\n')).toBe(true);
  });

  it('rejects missing specs', () => {
    const db = createDb(':memory:');

    expect(() => exportSeedFixture(db, { specId: 404 })).toThrow(/spec 404 does not exist/);
  });
});
