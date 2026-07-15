import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../../../../executor/plan-file.js';
import { withRunExecutionAuthority } from '../../../../executor/run-execution-authority.js';
import { runMetadataPath } from '../../../../executor/run.js';
import { createExecuteReplanRegeneratePlanTool } from '../execute-replan-regenerate-plan/index.js';
import { createExecuteRunCreateTool } from '../execute-run-create/index.js';

const reads = {
  queryGraph: () => ({
    lsn: 9,
    nodes: [
      {
        specId: 7,
        basis: 'explicit',
        settlement: 'settled',
        createdAtLsn: 1,
        updatedAtLsn: 1,
        id: 10,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 1,
        title: 'Build feature',
      },
    ],
    edges: [],
  }),
} as never;

describe('execute tool authority contention', () => {
  it('reports the persisted lifecycle status for an active run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-contention-'));
    const metadataPath = runMetadataPath(cwd, 'run-1');
    await mkdir(dirname(metadataPath), { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '7',
        planPath: '/tmp/plan.yaml',
        status: 'slice_execution_requested',
      }),
      'utf8',
    );
    const persistedPlanPath = planFilePath(cwd, '7');
    await mkdir(dirname(persistedPlanPath), { recursive: true });
    await writeFile(
      persistedPlanPath,
      JSON.stringify({
        execution_contract: {
          schemaVersion: 1,
          requiredCapabilities: [],
          detectedCapabilities: [],
          resolvedActions: {
            setup: [],
            build: [],
            verify: [
              {
                capabilityId: 'spec.verify',
                providerId: 'spec-recipe',
                command: 'npm',
                args: ['test'],
              },
            ],
          },
          blocked: [],
          conflicts: [],
        },
      }),
      'utf8',
    );
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const owner = withRunExecutionAuthority({
      cwd,
      runId: 'run-1',
      execute: async () => {
        entered();
        await held;
      },
    });
    await acquired;

    try {
      const runCreate = await createExecuteRunCreateTool({ specId: 7, reads }).execute(
        'call-1',
        { runId: 'run-1' },
        undefined,
        undefined,
        { cwd } as never,
      );
      const regenerate = await createExecuteReplanRegeneratePlanTool({ specId: 7, reads }).execute(
        'call-2',
        { runId: 'run-1' },
        undefined,
        undefined,
        { cwd } as never,
      );

      expect(runCreate.details).toMatchObject({
        result: { status: 'run_execution_active', runStatus: 'slice_execution_requested' },
      });
      expect(regenerate.details).toMatchObject({
        result: { status: 'run_execution_active', runStatus: 'slice_execution_requested' },
      });
    } finally {
      release();
      await owner;
    }
  });
});
