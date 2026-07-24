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
import {
  buildBrunchExecutionSeed,
  buildOpaqueBrownfieldExecutionSeed,
  buildOpaqueBrunchExecutionSeed,
  prepareBrunchExecutionWorkspace,
} from '../brunch-lane.js';
import { isBrowserExecutionCaseContract, loadPublicCasePacket } from '../case-contract.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/', import.meta.url),
);
const petrinautCaseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/petrinaut-optimization/', import.meta.url),
);
const prospectCaseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/prospect-research-workspace/', import.meta.url),
);

describe('Brunch execution comparison lane adapter', () => {
  it('projects the frozen public packet into one complete greenfield execution scope', async () => {
    const packet = await loadPublicCasePacket(caseDir);
    if (!isBrowserExecutionCaseContract(packet.contract)) throw new Error('expected browser case');
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

  it('preserves an arbitrary target-authored specification as one exact settled requirement', async () => {
    const packet = await loadPublicCasePacket(caseDir);
    if (!isBrowserExecutionCaseContract(packet.contract)) throw new Error('expected browser case');
    const specification = '# Target-authored specification\n\nSpacing stays exact.  \n';
    const fixture = buildOpaqueBrunchExecutionSeed({
      specification,
      contract: packet.contract,
    });
    expect(fixture.nodes.find((node) => node.source === 'e2e-handoff [exact-spec]')).toMatchObject({
      kind: 'requirement',
      body: specification,
    });
    expect(fixture.nodes.filter((node) => node.source === 'e2e-handoff [exact-spec]')).toHaveLength(1);

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
    expect(projection.snapshot.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Approved target-authored specification',
          content: specification,
        }),
      ]),
    );
    expect(() => assertExecuteProjectionPlanReady(projection)).not.toThrow();
  });

  it('prepares the prospect workspace from the exact opaque specification', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'brunch-prospect-execution-'));
    const specification = await readFile(join(prospectCaseDir, 'spec.md'), 'utf8');
    const prepared = await prepareBrunchExecutionWorkspace({ workspaceDir, caseDir: prospectCaseDir });
    const graph = queryGraph(createDb(join(workspaceDir, '.brunch', 'brunch-v1.db')), prepared.specId);

    expect(graph.nodes.find((node) => node.source === 'e2e-handoff [exact-spec]')).toMatchObject({
      kind: 'requirement',
      body: specification,
    });
    expect(graph.nodes.filter((node) => node.source === 'e2e-handoff [exact-spec]')).toHaveLength(1);
    expect(JSON.stringify(graph)).not.toMatch(/Petri-net|static browser/iu);
    const publicContract = await readFile(join(prepared.publicDir, 'public-contract.json'), 'utf8');
    expect(publicContract).toBe(await readFile(join(prospectCaseDir, 'public-contract.json'), 'utf8'));
    expect(publicContract).toContain('/api/health');
    expect(publicContract).toContain('/api/state');
    for (const table of ['projects', 'runs', 'prospects', 'provenance', 'suppressions', 'decisions']) {
      expect(publicContract).toContain(`"${table}"`);
    }
    expect(publicContract).toContain('DATABASE_PATH');
    expect(publicContract).toContain('Research projects');
  });

  it('projects an opaque brownfield specification without Petri-specific execution wording', async () => {
    const packet = await loadPublicCasePacket(petrinautCaseDir);
    const specification = await readFile(join(petrinautCaseDir, 'spec.md'), 'utf8');
    const fixture = buildOpaqueBrownfieldExecutionSeed({
      specification,
      contract: packet.contract,
    });
    expect(fixture.nodes.find((node) => node.source === 'e2e-handoff [exact-spec]')).toMatchObject({
      kind: 'requirement',
      body: specification,
    });
    expect(JSON.stringify(fixture)).not.toMatch(/Petri-net|static browser|npm install/iu);

    const db = createDb(':memory:');
    const seeded = seedFixture(new CommandExecutor(db), fixture);
    const graph = queryGraph(db, seeded.specId);
    const projection = projectExecuteGraph({
      specId: seeded.specId,
      graphLsn: graph.lsn,
      mode: 'brownfield',
      nodes: graph.nodes,
      edges: graph.edges,
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
