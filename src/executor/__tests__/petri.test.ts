import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import type { ExecutorNetEvent } from '../orchestrate-topology.js';
import { compileExecutorTopology } from '../orchestrate.js';
import { petriEventsPath } from '../petri-events.js';
import { canProjectPetriReplay } from '../petri-replay-eligibility.js';
import { replayPetri, replayTransitionHistory } from '../petri-replay.js';
import { exportPetri, petriNetPath, petriSdcpnPath } from '../petri.js';
import {
  composePetrinautLauncherUrl,
  PETRINAUT_URL_INVALID_MESSAGE,
  PETRINAUT_URL_MISSING_MESSAGE,
  resolvePetrinautUrl,
} from '../petrinaut/launcher-url.js';
import {
  PETRI_RUN_COMPLETED_PLACE,
  PETRI_RUN_FINISH_TRANSITION,
  PETRI_RUN_HALTED_PLACE,
  reducePetrinautReplayExport,
} from '../petrinaut/replay-export.js';
import { SDCPN_FILE_FORMAT_VERSION } from '../petrinaut/sdcpn.js';
import { serializePetrinautSseFrame, serializePetrinautSseFrames } from '../petrinaut/sse.js';
import { foldPetrinautStreamFrames, projectPetrinautStreamFrames } from '../petrinaut/stream-frames.js';
import { populatedPlanPath } from '../populate.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';

const sdcpnFileSchema = z.object({
  version: z.number().int().min(1).max(SDCPN_FILE_FORMAT_VERSION),
  meta: z.object({ generator: z.literal('brunch'), generatorVersion: z.string().optional() }),
  title: z.string().min(1),
  places: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().regex(/^[A-Z][a-zA-Z]*\d*$/),
      colorId: z.null(),
      dynamicsEnabled: z.literal(false),
      differentialEquationId: z.null(),
    }),
  ),
  transitions: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      inputArcs: z.array(
        z.object({
          placeId: z.string().min(1),
          weight: z.number().positive(),
          type: z.enum(['standard', 'inhibitor']),
        }),
      ),
      outputArcs: z.array(z.object({ placeId: z.string().min(1), weight: z.number().positive() })),
      lambdaType: z.enum(['predicate', 'stochastic']),
      lambdaCode: z.string().min(1),
      transitionKernelCode: z.string().min(1),
    }),
  ),
  types: z.array(z.never()),
  differentialEquations: z.array(z.never()),
  parameters: z.array(z.never()),
  scenarios: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      scenarioParameters: z.array(z.never()),
      parameterOverrides: z.record(z.string(), z.string()),
      initialState: z.object({
        type: z.literal('per_place'),
        content: z.record(z.string(), z.string()),
      }),
    }),
  ),
  metrics: z.array(z.never()),
});

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
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'task-1.',
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'task-1 works.' }],
          derived_from: ['REQ1'],
        },
        {
          id: 'task-2',
          epic_id: 'frontier-1',
          definition: 'task-2.',
          verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'task-2 works.' }],
          derived_from: ['REQ2'],
        },
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
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'task-1.',
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'task-1 works.' }],
          derived_from: ['REQ1'],
        },
        {
          id: 'task-2',
          epic_id: 'frontier-1',
          definition: 'task-2.',
          verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'task-2 works.' }],
          derived_from: ['REQ2'],
        },
      ],
    });

    expect(result).toEqual({
      status: 'petri_exported',
      runStatus: 'petri_exported',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      petriPath: petriNetPath(cwd, 'run-1'),
      petriSdcpnPath: petriSdcpnPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: join(runDirPath(cwd, 'run-1'), 'petrinaut') },
        { kind: 'write_file', path: petriNetPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: petriSdcpnPath(cwd, 'run-1'), ifExists: 'overwrite' },
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
      expect.objectContaining({ id: 'slice:task-1', epicId: 'frontier-1', derivedFrom: ['REQ1'] }),
    );
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'petri_exported',
      petriPath: petriNetPath(cwd, 'run-1'),
    });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    expect(sdcpnFileSchema.safeParse(sdcpnFile).success).toBe(true);
    expect(sdcpnFile).toMatchObject({
      version: SDCPN_FILE_FORMAT_VERSION,
      meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
      title: 'Executor run run-1',
      scenarios: [
        {
          id: 'scenario__initial-marking',
          initialState: { type: 'per_place', content: { 'run:created': '1' } },
        },
      ],
    });
    expect(sdcpnFile.places.map((place: { readonly id: string }) => place.id).sort()).toEqual(
      topology.places.map((place) => place.id).sort(),
    );
    expect(sdcpnFile.transitions.map((transition: { readonly id: string }) => transition.id).sort()).toEqual(
      topology.transitions.map((transition) => transition.id).sort(),
    );
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'promotion'))).toBe(false);
  });

  it('exports from the same worktree plan fallback used by drive and observers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-export-worktree-plan-fallback-'));
    await createCompletedRun(cwd);
    const runPlanPath = populatedPlanPath(cwd, 'run-1');
    await mkdir(join(runDirPath(cwd, 'run-1'), 'worktree', '.brunch', 'cook'), { recursive: true });
    await writeFile(
      runPlanPath,
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ id: 'worktree-task' }],
      }),
      'utf8',
    );
    await writeFile(
      join(cwd, 'plan.yaml'),
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ id: 'source-task' }],
      }),
      'utf8',
    );

    const result = await exportPetri({ cwd, runId: 'run-1' });

    expect(result.status).toBe('petri_exported');
    const net = JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')) as {
      readonly subnets: readonly { readonly id: string }[];
    };
    expect(net.subnets).toContainEqual(expect.objectContaining({ id: 'slice:worktree-task' }));
    expect(net.subnets).not.toContainEqual(expect.objectContaining({ id: 'slice:source-task' }));
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

    await expect(exportPetri({ cwd, runId: 'run-1' })).resolves.toEqual({
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
        petriEvents: { exists: true, torn: false, total: 1 },
      }),
    ).toBe(true);

    expect(
      canProjectPetriReplay({
        petriNet: undefined,
        petriEvents: { exists: true, torn: false, total: 1 },
      }),
    ).toBe(false);

    expect(
      canProjectPetriReplay({
        petriNet: { initialMarking: {}, transitions: [] },
        petriEvents: { exists: false, torn: false, total: 0 },
      }),
    ).toBe(false);

    expect(
      canProjectPetriReplay({
        petriNet: { initialMarking: {}, transitions: [] },
        petriEvents: { exists: true, torn: true, total: 1 },
      }),
    ).toBe(false);

    expect(
      canProjectPetriReplay({
        petriNet: { initialMarking: {}, transitions: [] },
        petriEvents: { exists: true, torn: false, total: 0 },
      }),
    ).toBe(false);
  });
});

describe('replayPetri', () => {
  it('strips terminal summary when the raw journal contains contradictory terminal events', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      slices: [{ id: 'task-1' }],
    });

    expect(
      replayPetri({
        net: topology,
        events: [
          {
            kind: 'transition_fired',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            transitionId: 'worktree_create',
            subnetId: 'run',
            step: 'worktree_create',
            contract: { kind: 'mechanical', lane: 'run' },
            consumed: ['run:created'],
            produced: ['run:worktree_created'],
            fromStatus: 'created',
            toStatus: 'worktree_created',
          },
          { kind: 'net_completed', runId: 'run-1', runStatus: 'promotion_prepared' },
          { kind: 'net_deadlocked', runId: 'run-1', runStatus: 'promotion_prepared' },
        ],
      }),
    ).toEqual({
      currentMarking: { 'run:worktree_created': 1 },
      firedTransitionCount: 1,
    });
  });

  it('strips terminal summary when the raw journal fires again after a terminal event', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      slices: [{ id: 'task-1' }],
    });

    expect(
      replayPetri({
        net: topology,
        events: [
          {
            kind: 'transition_fired',
            runId: 'run-1',
            runStatus: 'worktree_created',
            transitionId: 'worktree_create',
            subnetId: 'run',
            step: 'worktree_create',
            contract: { kind: 'mechanical', lane: 'run' },
            consumed: ['run:created'],
            produced: ['run:worktree_created'],
            fromStatus: 'created',
            toStatus: 'worktree_created',
          },
          { kind: 'net_completed', runId: 'run-1', runStatus: 'worktree_created' },
          {
            kind: 'transition_fired',
            runId: 'run-1',
            runStatus: 'reports_initialized',
            transitionId: 'populate',
            subnetId: 'run',
            step: 'populate',
            contract: { kind: 'mechanical', lane: 'run' },
            consumed: ['run:worktree_created'],
            produced: ['run:worktree_populated'],
            fromStatus: 'worktree_created',
            toStatus: 'worktree_populated',
          },
        ],
      }),
    ).toEqual({
      currentMarking: { 'run:worktree_populated': 1 },
      firedTransitionCount: 2,
    });
  });

  it('strips terminal summary when a replayed halt event has no reason', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      slices: [{ id: 'task-1' }],
    });

    expect(
      replayPetri({
        net: topology,
        events: [
          {
            kind: 'transition_fired',
            runId: 'run-1',
            runStatus: 'worktree_created',
            transitionId: 'worktree_create',
            subnetId: 'run',
            step: 'worktree_create',
            contract: { kind: 'mechanical', lane: 'run' },
            consumed: ['run:created'],
            produced: ['run:worktree_created'],
            fromStatus: 'created',
            toStatus: 'worktree_created',
          },
          { kind: 'net_halted', runId: 'run-1', runStatus: 'worktree_created' },
        ],
      }),
    ).toEqual({
      currentMarking: { 'run:worktree_created': 1 },
      firedTransitionCount: 1,
    });
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

describe('reducePetrinautReplayExport', () => {
  it('projects SDCPN plus journal events into a compact Petrinaut replay payload', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-export-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    const events: ExecutorNetEvent[] = [
      {
        kind: 'transition_fired',
        runId: 'run-1',
        runStatus: 'worktree_created',
        transitionId: 'worktree_create',
        subnetId: 'run',
        step: 'worktree_create',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:created'],
        produced: ['run:worktree_created'],
        fromStatus: 'created',
        toStatus: 'worktree_created',
      },
      {
        kind: 'transition_fired',
        runId: 'run-1',
        runStatus: 'worktree_populated',
        transitionId: 'populate',
        subnetId: 'run',
        step: 'populate',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:worktree_created'],
        produced: ['run:worktree_populated'],
        fromStatus: 'worktree_created',
        toStatus: 'worktree_populated',
      },
      { kind: 'net_completed', runId: 'run-1', runStatus: 'promotion_prepared' },
    ];

    const payload = reducePetrinautReplayExport({ sdcpnFile, events });

    expect(payload.initialState).toEqual({ 'run:created': 1 });
    expect(payload.definition.places).toContainEqual({
      id: PETRI_RUN_COMPLETED_PLACE,
      name: 'Run completed',
    });
    expect(payload.definition.places).toContainEqual({ id: PETRI_RUN_HALTED_PLACE, name: 'Run halted' });
    expect(payload.definition.transitions).toContainEqual({
      id: PETRI_RUN_FINISH_TRANSITION,
      name: 'Run finish',
      inputArcs: [],
      outputArcs: [
        { placeId: PETRI_RUN_COMPLETED_PLACE, weight: 1 },
        { placeId: PETRI_RUN_HALTED_PLACE, weight: 1 },
      ],
    });
    expect(payload.definition.transitions[0]).toEqual({
      id: 'worktree_create',
      name: 'worktree_create',
      inputArcs: [{ placeId: 'run:created', weight: 1, type: 'standard' }],
      outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
    });
    expect(payload.transitionFirings).toEqual([
      {
        transitionId: 'worktree_create',
        input: { 'run:created': 1 },
        output: { 'run:worktree_created': 1 },
      },
      {
        transitionId: 'populate',
        input: { 'run:worktree_created': 1 },
        output: { 'run:worktree_populated': 1 },
      },
      {
        transitionId: PETRI_RUN_FINISH_TRANSITION,
        input: {},
        output: { [PETRI_RUN_COMPLETED_PLACE]: 1 },
      },
    ]);
  });

  it('projects halt and deadlock terminal events to the halted run-status place', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-export-halted-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));

    expect(
      reducePetrinautReplayExport({
        sdcpnFile,
        events: [{ kind: 'net_halted', runId: 'run-1', runStatus: 'worktree_created', reason: 'boom' }],
      }).transitionFirings,
    ).toEqual([
      { transitionId: PETRI_RUN_FINISH_TRANSITION, input: {}, output: { [PETRI_RUN_HALTED_PLACE]: 1 } },
    ]);
    expect(
      reducePetrinautReplayExport({
        sdcpnFile,
        events: [{ kind: 'net_deadlocked', runId: 'run-1', runStatus: 'worktree_created' }],
      }).transitionFirings,
    ).toEqual([
      { transitionId: PETRI_RUN_FINISH_TRANSITION, input: {}, output: { [PETRI_RUN_HALTED_PLACE]: 1 } },
    ]);
  });

  it('fails closed when a journal transition is absent from the SDCPN definition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-export-unknown-transition-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));

    expect(() =>
      reducePetrinautReplayExport({
        sdcpnFile,
        events: [
          {
            kind: 'transition_fired',
            runId: 'run-1',
            runStatus: 'worktree_created',
            transitionId: 'missing-transition',
            subnetId: 'run',
            step: 'worktree_create',
            contract: { kind: 'mechanical', lane: 'run' },
            consumed: ['run:created'],
            produced: ['run:worktree_created'],
            fromStatus: 'created',
            toStatus: 'worktree_created',
          },
        ],
      }),
    ).toThrow(/missing-transition/);
  });

  it('fails closed when SDCPN transition ids collide', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-export-duplicate-transition-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    sdcpnFile.transitions = [sdcpnFile.transitions[0], sdcpnFile.transitions[0]];

    expect(() => reducePetrinautReplayExport({ sdcpnFile, events: [] })).toThrow(
      /Duplicate Petrinaut transition id/,
    );
  });

  it('fails closed when SDCPN initial marking counts are not integer strings', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-export-malformed-marking-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    sdcpnFile.scenarios[0].initialState.content['run:created'] = '1abc';

    expect(() => reducePetrinautReplayExport({ sdcpnFile, events: [] })).toThrow(
      /Invalid Petrinaut initial marking count/,
    );
  });
});

describe('Petrinaut launcher URL helpers', () => {
  it('resolves Petrinaut URL from env and reports stable missing/invalid errors', () => {
    expect(resolvePetrinautUrl({ env: { PETRINAUT_URL: 'https://env.example/brunch' } })).toEqual({
      url: 'https://env.example/brunch',
    });
    expect(resolvePetrinautUrl({ env: { PETRINAUT_URL: '' } })).toEqual({
      error: PETRINAUT_URL_MISSING_MESSAGE,
    });
    expect(resolvePetrinautUrl({ env: { PETRINAUT_URL: 'file:///tmp/petrinaut.html' } })).toEqual({
      error: PETRINAUT_URL_INVALID_MESSAGE,
    });
  });

  it('composes runId and encoded SSE endpoint while preserving Petrinaut path/query', () => {
    const streamUrl = 'http://127.0.0.1:51234/stream?x=1&y=2';
    const url = composePetrinautLauncherUrl({
      petrinautUrl: 'https://petrinaut.example/brunch?theme=dark',
      runId: 'run-1',
      streamUrl,
    });
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/brunch');
    expect(parsed.searchParams.get('theme')).toBe('dark');
    expect(parsed.searchParams.get('runId')).toBe('run-1');
    expect(parsed.searchParams.get('sse')).toBe(streamUrl);
    expect(parsed.searchParams.has('mode')).toBe(false);
    expect(url).toContain('sse=http%3A%2F%2F127.0.0.1%3A51234%2Fstream%3Fx%3D1%26y%3D2');
  });
});

describe('Petrinaut stream frame projection', () => {
  it('projects a replay export into ordered stream frames and folds back to the export', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-stream-frames-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    const replayExport = reducePetrinautReplayExport({
      sdcpnFile,
      events: [
        {
          kind: 'transition_fired',
          runId: 'run-1',
          runStatus: 'worktree_created',
          transitionId: 'worktree_create',
          subnetId: 'run',
          step: 'worktree_create',
          contract: { kind: 'mechanical', lane: 'run' },
          consumed: ['run:created'],
          produced: ['run:worktree_created'],
          fromStatus: 'created',
          toStatus: 'worktree_created',
        },
      ],
    });

    const frames = projectPetrinautStreamFrames({ replayExport });

    expect(frames.map((frame) => frame.kind)).toEqual([
      'status',
      'definition',
      'initial_state',
      'transition_firing',
    ]);
    expect(frames[0]).toEqual({ kind: 'status', state: 'running' });
    expect(foldPetrinautStreamFrames(frames)).toEqual(replayExport);
  });

  it('adds terminal status and terminal frames when terminal state is supplied', () => {
    const replayExport = {
      definition: {
        version: 1,
        meta: { generator: 'brunch' },
        title: 'run',
        places: [],
        transitions: [],
      },
      initialState: {},
      transitionFirings: [],
    };

    const frames = projectPetrinautStreamFrames({
      replayExport,
      terminal: { state: 'halted', reason: 'promotion_failed' },
    });

    expect(frames).toEqual([
      { kind: 'status', state: 'halted', reason: 'promotion_failed' },
      { kind: 'definition', definition: replayExport.definition },
      { kind: 'initial_state', initialState: {} },
      { kind: 'terminal', state: 'halted', reason: 'promotion_failed' },
    ]);
  });
});

describe('Petrinaut SSE serialization', () => {
  it('serializes one frame as a named SSE event with one JSON data line and a blank terminator', () => {
    expect(serializePetrinautSseFrame({ kind: 'status', state: 'halted', reason: 'promotion_failed' })).toBe(
      'event: status\ndata: {"state":"halted","reason":"promotion_failed"}\n\n',
    );
  });

  it('serializes each frame kind with the expected event name and JSON payload', () => {
    const frames = projectPetrinautStreamFrames({
      replayExport: {
        definition: {
          version: 1,
          meta: { generator: 'brunch' },
          title: 'run',
          places: [{ id: 'run:created', name: 'RunCreated' }],
          transitions: [],
        },
        initialState: { 'run:created': 1 },
        transitionFirings: [
          {
            transitionId: 'worktree_create',
            input: { 'run:created': 1 },
            output: { 'run:worktree_created': 1 },
          },
        ],
      },
      terminal: { state: 'completed' },
    });
    const chunks = serializePetrinautSseFrames(frames)
      .split('\n\n')
      .filter((chunk) => chunk.length > 0);

    expect(chunks.map((chunk) => chunk.split('\n')[0])).toEqual([
      'event: status',
      'event: definition',
      'event: initial_state',
      'event: transition_firing',
      'event: terminal',
    ]);
    expect(JSON.parse(chunks[1]!.split('\n')[1]!.slice('data: '.length))).toMatchObject({
      title: 'run',
      places: [{ id: 'run:created' }],
    });
    expect(JSON.parse(chunks[3]!.split('\n')[1]!.slice('data: '.length))).toEqual({
      transitionId: 'worktree_create',
      input: { 'run:created': 1 },
      output: { 'run:worktree_created': 1 },
    });
    expect(JSON.parse(chunks[4]!.split('\n')[1]!.slice('data: '.length))).toEqual({ state: 'completed' });
  });

  it('batch serialization is exactly the concatenation of per-frame chunks', () => {
    const frames = [
      { kind: 'status' as const, state: 'running' as const },
      { kind: 'initial_state' as const, initialState: { p1: 2 } },
    ];

    expect(serializePetrinautSseFrames(frames)).toBe(
      `${serializePetrinautSseFrame(frames[0]!)}${serializePetrinautSseFrame(frames[1]!)}`,
    );
  });
});
