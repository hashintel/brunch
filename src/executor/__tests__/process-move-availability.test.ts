import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { GraphEdge } from '../../graph/schema/edges.js';
import type { GraphNode } from '../../graph/schema/nodes.js';
import { projectExecuteGraph } from '../execute-projection.js';
import { writePlanFile } from '../plan-file.js';
import { resolveDeterministicProcessMoveAvailability } from '../process-move-availability.js';

const base = {
  specId: 7,
  basis: 'explicit',
  settlement: 'settled',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;
const requirement = {
  ...base,
  id: 1,
  plane: 'intent',
  kind: 'requirement',
  kindOrdinal: 1,
  title: 'Build it',
} as const satisfies GraphNode;
const criterion = {
  ...base,
  id: 2,
  plane: 'intent',
  kind: 'criterion',
  kindOrdinal: 1,
  title: 'It works',
} as const satisfies GraphNode;
const harness = {
  ...base,
  id: 3,
  plane: 'oracle',
  kind: 'vv_method',
  kindOrdinal: 1,
  title: 'Project execution harness',
  body: 'execute.verify: npm test',
} as const satisfies GraphNode;
const witness = {
  ...base,
  id: 1,
  category: 'witness',
  sourceId: 2,
  targetId: 1,
  stance: 'for',
} as const satisfies GraphEdge;
const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

async function cwd() {
  const dir = await mkdtemp(join(tmpdir(), 'brunch-availability-'));
  dirs.push(dir);
  return dir;
}
function input(
  dir: string,
  nodes: readonly GraphNode[] = [requirement, criterion, harness],
  edges: readonly GraphEdge[] = [witness],
) {
  return { cwd: dir, specId: 7, graphLsn: 9, nodes, edges };
}

describe('resolveDeterministicProcessMoveAvailability', () => {
  it('fails closed for thin input and missing authored verification', async () => {
    const dir = await cwd();
    expect(await resolveDeterministicProcessMoveAvailability(input(dir, [], []))).toMatchObject({
      prepare_execution: true,
      compile_plan: false,
      execute_plan: false,
    });
    expect(
      await resolveDeterministicProcessMoveAvailability(input(dir, [requirement, criterion], [witness])),
    ).toMatchObject({ compile_plan: false, execute_plan: false });
  });

  it('offers Compile after deterministic admission but hides Execute without a current plan', async () => {
    expect(await resolveDeterministicProcessMoveAvailability(input(await cwd()))).toMatchObject({
      prepare_execution: true,
      compile_plan: true,
      execute_plan: false,
    });
  });

  it('offers Execute only for the current launch-ready plan, including brownfield provenance', async () => {
    const dir = await cwd();
    const projection = projectExecuteGraph({ ...input(dir), mode: 'brownfield' });
    await writePlanFile({ cwd: dir, preview: projection.planPreview, source: projection.source });
    const current = {
      specId: '7',
      mode: 'brownfield' as const,
      source: projection.source,
      checkStatus: projection.check.status,
    };
    expect(
      await resolveDeterministicProcessMoveAvailability({ cwd: dir, projection, current }),
    ).toMatchObject({ compile_plan: true, execute_plan: true });
    expect(
      await resolveDeterministicProcessMoveAvailability({
        cwd: dir,
        projection,
        current: { ...current, source: { ...current.source, graphLsn: 10 } },
      }),
    ).toMatchObject({ compile_plan: true, execute_plan: false });
  });

  it('does not mutate graph inputs or plan, provenance, and run inventory bytes', async () => {
    const dir = await cwd();
    const args = input(dir);
    const projection = projectExecuteGraph(args);
    await writePlanFile({ cwd: dir, preview: projection.planPreview, source: projection.source });
    const graphBefore = JSON.stringify({ nodes: args.nodes, edges: args.edges, lsn: args.graphLsn });
    const specsDir = join(dir, '.brunch', 'cook', 'specs', '7');
    const files = await readdir(specsDir);
    const bytesBefore = await Promise.all(files.map((file) => readFile(join(specsDir, file))));
    const runsRoot = join(dir, '.brunch', 'cook', 'runs');
    const runsBefore = await readdir(runsRoot).catch(() => [] as string[]);

    await resolveDeterministicProcessMoveAvailability(args);

    expect(JSON.stringify({ nodes: args.nodes, edges: args.edges, lsn: args.graphLsn })).toBe(graphBefore);
    expect(await readdir(specsDir)).toEqual(files);
    const bytesAfter = await Promise.all(files.map((file) => readFile(join(specsDir, file))));
    expect(bytesAfter.map(String)).toEqual(bytesBefore.map(String));
    expect(await readdir(runsRoot).catch(() => [] as string[])).toEqual(runsBefore);
  });
});
