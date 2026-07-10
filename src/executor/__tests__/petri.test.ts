import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutorTopology } from '../orchestrate.js';
import { petriEventsPath } from '../petri-events.js';
import { canProjectPetriReplay } from '../petri-replay-eligibility.js';
import { replayPetri, replayTransitionHistory } from '../petri-replay.js';
import { exportPetri, petriNetPath } from '../petri.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createCompletedRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const planPath = join(cwd, 'plan.yaml');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', depends_on: [] }],
      slices: [
        { id: 'task-1', epic_id: 'frontier-1' },
        { id: 'task-2', epic_id: 'frontier-1' },
      ],
    }),
    'utf8',
  );
  await writeFile(reportPath, '{"event":"run_completed","runId":"run-1"}\n', 'utf8');
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath,
      status: 'run_completed',
      reportsPath: reportPath,
      completedSliceIds: ['task-1', 'task-2'],
    }),
    'utf8',
  );
}

describe('exportPetri', () => {
  it('does not export Petri before run completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-not-ready-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'slice_completed' }),
      'utf8',
    );

    const result = await exportPetri({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'run_not_completed',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
  });

  it('exports a topology-aware Petri net artifact for a completed run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-ready-'));
    await createCompletedRun(cwd);

    const result = await exportPetri({ cwd, runId: 'run-1' });
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', depends_on: [] }],
      slices: [
        { id: 'task-1', epic_id: 'frontier-1' },
        { id: 'task-2', epic_id: 'frontier-1' },
      ],
    });

    expect(result).toEqual({
      status: 'petri_exported',
      runStatus: 'petri_exported',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      petriPath: petriNetPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: join(runDirPath(cwd, 'run-1'), 'petrinaut') },
        { kind: 'write_file', path: petriNetPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      epics: topology.epics,
      subnets: topology.subnets,
      places: topology.places,
      transitions: topology.transitions,
      initialMarking: topology.initialMarking,
    });
    expect(topology.subnets).toContainEqual(
      expect.objectContaining({ id: 'slice:task-1', epicId: 'frontier-1' }),
    );
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'petri_exported',
      petriPath: petriNetPath(cwd, 'run-1'),
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'promotion'))).toBe(false);
  });

  it('refuses to export when the compiled plan input is unreadable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-unreadable-plan-'));
    await createCompletedRun(cwd);
    await writeFile(join(cwd, 'plan.yaml'), '{"mode":', 'utf8');

    const result = await exportPetri({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'petri_input_unreadable',
      runStatus: 'run_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'run_completed',
    });
  });

  it('refuses to export when the compiled plan input is structurally invalid', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-invalid-plan-shape-'));
    await createCompletedRun(cwd);
    await writeFile(
      join(cwd, 'plan.yaml'),
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ epic_id: 'frontier-1' }],
      }),
      'utf8',
    );

    const result = await exportPetri({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'petri_input_unreadable',
      runStatus: 'run_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'run_completed',
    });
  });

  it('refuses to export a Petri net when slice ids collide in the compiled plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-duplicate-slice-id-'));
    await createCompletedRun(cwd);
    await writeFile(
      join(cwd, 'plan.yaml'),
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ id: 'task-1' }, { id: 'task-1' }],
      }),
      'utf8',
    );

    await expect(exportPetri({ cwd, runId: 'run-1' })).rejects.toThrow(
      'Duplicate slice id in executor topology: task-1',
    );
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'run_completed',
    });
  });

  it('replays the emitted Petri journal to the expected final marking for a completed serial run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    await writeFile(
      petriEventsPath(cwd, 'run-1'),
      [
        'worktree_create',
        'populate',
        'source_policy',
        'source_copy',
        'report_init',
        'slice_start:task-1',
        'slice_execute:task-1',
        'agent_result:task-1',
        'test_result:task-1',
        'slice_complete:task-1',
        'slice_start:task-2',
        'slice_execute:task-2',
        'agent_result:task-2',
        'test_result:task-2',
        'slice_complete:task-2',
        'run_complete',
        'petri_export',
        'promotion',
      ]
        .map((transitionId) =>
          JSON.stringify({
            kind: 'transition_fired',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            transitionId,
            subnetId:
              transitionId.startsWith('slice_') ||
              transitionId.startsWith('agent_') ||
              transitionId.startsWith('test_')
                ? `slice:${transitionId.split(':')[1]}`
                : 'run',
            step: transitionId.split(':')[0],
            fromStatus: 'created',
            toStatus: 'promotion_prepared',
          }),
        )
        .concat(JSON.stringify({ kind: 'net_completed', runId: 'run-1', runStatus: 'promotion_prepared' }))
        .join('\n') + '\n',
      'utf8',
    );

    const projection = replayPetri({
      net: JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')),
      events: (await readFile(petriEventsPath(cwd, 'run-1'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
    });

    expect(projection).toEqual({
      currentMarking: { 'run:promotion_prepared': 1 },
      firedTransitionCount: 18,
      terminalEventKind: 'net_completed',
    });
  });
});

describe('canProjectPetriReplay', () => {
  it('allows replay only when the raw net exists and the journal exists without torn lines', () => {
    expect(
      canProjectPetriReplay({
        petriNet: { initialMarking: {}, transitions: [] },
        petriEvents: { exists: true, torn: false },
      }),
    ).toBe(true);

    expect(
      canProjectPetriReplay({
        petriNet: undefined,
        petriEvents: { exists: true, torn: false },
      }),
    ).toBe(false);

    expect(
      canProjectPetriReplay({
        petriNet: { initialMarking: {}, transitions: [] },
        petriEvents: { exists: false, torn: false },
      }),
    ).toBe(false);

    expect(
      canProjectPetriReplay({
        petriNet: { initialMarking: {}, transitions: [] },
        petriEvents: { exists: true, torn: true },
      }),
    ).toBe(false);
  });
});

describe('replayTransitionHistory', () => {
  it('replays transition ids over a compiled executor topology for shared runtime/read-side marking recovery', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2' }],
    });

    expect(
      replayTransitionHistory(topology, [
        'worktree_create',
        'populate',
        'source_policy',
        'source_copy',
        'report_init',
        'slice_start:task-2',
        'slice_execute:task-2',
        'agent_result:task-2',
      ]),
    ).toEqual({
      currentMarking: { 'slice:task-2:agent_result_ingested': 1 },
      firedTransitionCount: 8,
    });

    expect(replayTransitionHistory(topology, ['missing-transition'])).toBeUndefined();
  });
});
