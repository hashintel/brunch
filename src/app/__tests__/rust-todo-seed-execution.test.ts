import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { projectExecutionSpecSnapshot } from '../../executor/execution-spec-snapshot.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { queryGraph } from '../../graph/queries.js';
import { seedFixture, type SeedFixture } from '../../graph/seed-fixtures.js';

describe('rust todo execution seed', () => {
  it('projects into a complete execution scope', () => {
    const fixture = JSON.parse(
      readFileSync(resolve(process.cwd(), '.fixtures/seeds/rust-todo-cli/base.json'), 'utf8'),
    ) as SeedFixture;
    const db = createDb(':memory:');
    const seeded = seedFixture(new CommandExecutor(db), fixture);
    const graph = queryGraph(db, seeded.specId);

    const snapshot = projectExecutionSpecSnapshot({
      specId: seeded.specId,
      mode: 'greenfield',
      nodes: graph.nodes,
      edges: graph.edges,
    });

    expect(snapshot.frontiers).toEqual([expect.objectContaining({ itemId: 'F1' })]);
    expect(snapshot.scopes).toEqual([
      expect.objectContaining({
        itemId: 'SCP1',
        frontierIds: ['F1'],
        criteria: [expect.objectContaining({ itemId: 'AC1' })],
        design: [expect.objectContaining({ itemId: 'MOD1' })],
        verification: [expect.objectContaining({ itemId: 'CH1' })],
      }),
    ]);
  });
});
