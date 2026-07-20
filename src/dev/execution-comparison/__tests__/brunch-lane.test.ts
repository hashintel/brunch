import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createDb } from '../../../db/connection.js';
import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../executor/execute-projection.js';
import { CommandExecutor } from '../../../graph/command-executor.js';
import { queryGraph } from '../../../graph/queries.js';
import { seedFixture } from '../../../graph/seed-fixtures.js';
import { buildBrunchExecutionSeed, prepareBrunchExecutionWorkspace } from '../brunch-lane.js';
import { loadPublicCasePacket } from '../case-contract.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/', import.meta.url),
);

describe('Brunch execution comparison lane adapter', () => {
  it('projects the frozen public packet into one complete greenfield execution scope', async () => {
    const packet = await loadPublicCasePacket(caseDir);
    const specification = await readFile(`${caseDir}/spec.md`, 'utf8');
    const fixture = buildBrunchExecutionSeed({ specification, contract: packet.contract });
    expect(fixture.nodes.find((node) => node.source === 'approved-spec [D1]')).toMatchObject({
      title: 'Net flavor: classic P/T, weighted arcs, unbounded places',
      body: 'Net flavor: classic P/T, weighted arcs, unbounded places',
      detail: {
        chosen_option: 'Net flavor: classic P/T, weighted arcs, unbounded places',
      },
    });
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

    expect(fixture.nodes.filter((node) => node.source?.startsWith('approved-spec ['))).toHaveLength(34);
    expect(projection.snapshot.frontiers).toEqual([
      expect.objectContaining({ itemId: 'F1', title: 'Deliver the minimal Petri-net editor' }),
    ]);
    expect(projection.snapshot.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Create and edit net on a canvas' }),
        expect.objectContaining({ title: 'Public execution accessibility contract' }),
      ]),
    );
    expect(projection.snapshot.scopes).toEqual([
      expect.objectContaining({
        itemId: 'SCP1',
        frontierIds: ['F1'],
        requirementIds: expect.arrayContaining(['REQ1', 'REQ13']),
        criteria: expect.arrayContaining([
          expect.objectContaining({ title: 'App mounts through its real browser entry point' }),
        ]),
        design: [expect.objectContaining({ itemId: 'MOD1' })],
        verification: [expect.objectContaining({ itemId: 'CH1' })],
      }),
    ]);
    expect(projection.executionContract.blocked).toEqual([]);
    expect(projection.executionContract.resolvedActions).toEqual({
      setup: [
        expect.objectContaining({
          capabilityId: 'spec.setup',
          command: 'npm',
          args: ['install'],
        }),
      ],
      build: [
        expect.objectContaining({
          capabilityId: 'spec.build',
          command: 'npm',
          args: ['run', 'build'],
        }),
      ],
      verify: [
        expect.objectContaining({
          capabilityId: 'spec.verify',
          command: 'npm',
          args: ['test'],
        }),
      ],
    });
    expect(() => assertExecuteProjectionPlanReady(projection)).not.toThrow();
  });

  it('prepares a fresh Brunch workspace with only the content-addressed public packet', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'brunch-execution-lane-'));
    const prepared = await prepareBrunchExecutionWorkspace({ workspaceDir, caseDir });

    expect(prepared.specId).toBe(1);
    expect(await readdir(prepared.publicDir)).toEqual([
      'packet-manifest.json',
      'public-contract.json',
      'spec.md',
    ]);
    expect(await readFile(join(prepared.publicDir, 'spec.md'), 'utf8')).toBe(
      await readFile(join(caseDir, 'spec.md'), 'utf8'),
    );
    expect(
      JSON.parse(await readFile(join(prepared.publicDir, 'packet-manifest.json'), 'utf8')),
    ).toMatchObject({
      caseId: 'minimal-petri-net-editor-v1',
      packetSha256: prepared.packet.packetSha256,
      files: [{ path: 'public-contract.json' }, { path: 'spec.md' }],
    });
    expect(
      (await readdir(workspaceDir, { recursive: true })).some((path) => path.includes('controller')),
    ).toBe(false);
  });
});
