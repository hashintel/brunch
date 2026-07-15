import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { projectExecuteGraph } from '../../executor/execute-projection.js';
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

    const projection = projectExecuteGraph({
      specId: seeded.specId,
      graphLsn: graph.lsn,
      mode: 'greenfield',
      nodes: graph.nodes,
      edges: graph.edges,
    });
    const snapshot = projection.snapshot;

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
    expect(projection.executionContract.resolvedActions).toEqual({
      setup: [
        expect.objectContaining({
          capabilityId: 'spec.setup',
          command: 'cargo',
          args: ['fetch'],
        }),
      ],
      build: [
        expect.objectContaining({
          capabilityId: 'spec.build',
          command: 'cargo',
          args: ['build', '--release'],
        }),
      ],
      verify: [
        expect.objectContaining({
          capabilityId: 'spec.verify',
          command: 'cargo',
          args: ['test'],
        }),
      ],
    });
  });
});
