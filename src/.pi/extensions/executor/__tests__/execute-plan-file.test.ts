import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { PlannerPort } from '../../../../executor/execution-ports.js';
import { planFilePath } from '../../../../executor/plan-file.js';
import { createExecutePlanFileTool } from '../execute-plan-file/index.js';

const base = {
  specId: 7,
  basis: 'explicit',
  settlement: 'settled',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

const nodes = [
  { ...base, id: 9, plane: 'intent', kind: 'decision', kindOrdinal: 1, title: 'Ship on npm test' },
  { ...base, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Build feature' },
  { ...base, id: 20, plane: 'intent', kind: 'criterion', kindOrdinal: 1, title: 'Feature verified' },
];
const edges = [{ ...base, id: 1, category: 'witness', sourceId: 20, targetId: 10, stance: 'for' }];

function tool(planner?: PlannerPort) {
  return createExecutePlanFileTool({
    specId: 7,
    reads: { queryGraph: () => ({ lsn: 9, nodes, edges }) } as never,
    ...(planner ? { planner } : {}),
  });
}

function coherentCandidate() {
  return {
    schemaVersion: 1,
    specId: '7',
    epics: [{ id: 'E1', title: 'Deliver', dependsOn: [], verificationCriterionIds: [] }],
    slices: [
      {
        id: 'task-1',
        epicId: 'E1',
        title: 'Build feature',
        goal: 'Build the feature.',
        doneCriteria: ['Feature verified.'],
        requirementIds: ['REQ1'],
        criterionIds: ['AC1'],
        dependsOn: [],
        designItemIds: [],
        verificationItemIds: [],
      },
    ],
    requiredCapabilities: [{ id: 'node.npm-test', sourceItemId: 'D1' }],
  };
}

describe('createExecutePlanFileTool with a planner', () => {
  it('writes the synthesized admitted plan with its execution contract', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-file-synth-'));
    const planner: PlannerPort = {
      synthesize: async () => ({ status: 'synthesized', candidate: coherentCandidate() }),
    };

    const result = await tool(planner).execute('t1', {}, undefined, undefined, {
      cwd,
      modelRegistry: {},
    } as never);

    expect((result.content[0] as { text?: string })?.text).toContain('synthesis rounds: 1');
    const payload = JSON.parse(await readFile(planFilePath(cwd, '7'), 'utf8')) as {
      slices: readonly { id: string; definition: string }[];
      execution_contract?: { resolvedActions: { verify: readonly { command: string }[] } };
    };
    expect(payload.slices.map((slice) => slice.id)).toEqual(['task-1']);
    expect(payload.slices[0]?.definition).toContain('Done when:');
    expect(payload.execution_contract?.resolvedActions.verify[0]).toMatchObject({ command: 'npm' });
  });

  it('returns the findings and writes nothing when synthesis blocks', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-file-blocked-'));
    const planner: PlannerPort = {
      synthesize: async () => ({
        status: 'synthesized',
        candidate: { ...coherentCandidate(), requiredCapabilities: [] },
      }),
    };

    const result = await tool(planner).execute('t1', {}, undefined, undefined, {
      cwd,
      modelRegistry: {},
    } as never);

    expect((result.content[0] as { text?: string })?.text).toContain('plan_synthesis_blocked');
    expect((result.content[0] as { text?: string })?.text).toContain('no_verification_capability');
    await expect(readFile(planFilePath(cwd, '7'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the deterministic lowering path unchanged without a planner', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-file-det-'));

    const result = await tool().execute('t1', {}, undefined, undefined, { cwd } as never);

    expect((result.content[0] as { text?: string })?.text).not.toContain('synthesis rounds');
    const payload = JSON.parse(await readFile(planFilePath(cwd, '7'), 'utf8')) as {
      slices: readonly { id: string }[];
    };
    expect(payload.slices.map((slice) => slice.id)).toEqual(['task-1']);
  });

  it('falls back to deterministic lowering explicitly when the planner cannot run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-file-unavailable-'));
    const planner: PlannerPort = {
      synthesize: async () => ({ status: 'failed', message: 'should not be called' }),
    };

    const result = await tool(planner).execute('t1', {}, undefined, undefined, { cwd } as never);

    expect((result.content[0] as { text?: string })?.text).toContain(
      'planner unavailable (no model context); deterministic lowering used',
    );
    const payload = JSON.parse(await readFile(planFilePath(cwd, '7'), 'utf8')) as {
      slices: readonly { id: string }[];
    };
    expect(payload.slices.map((slice) => slice.id)).toEqual(['task-1']);
  });
});
