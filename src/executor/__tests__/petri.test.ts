import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import type { ExecutorNetEvent } from '../orchestrate-topology.js';
import { compileExecutorTopology } from '../orchestrate.js';
import {
  appendPetriEvent,
  appendPetriTerminalOnce,
  parsePetriEvent,
  petriEventsPath,
  readPetriJournal,
  subscribePetriEvents,
  subscribePetriJournalFailures,
} from '../petri-events.js';
import { canProjectPetriReplay } from '../petri-replay-eligibility.js';
import { replayPetri, replayTransitionHistory } from '../petri-replay.js';
import { exportPetri, petriNetPath, petriSdcpnPath, preparePetriObservation } from '../petri.js';
import { petrinautBrunchDefinitionSchema } from '../petrinaut/brunch-definition-schema.js';
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
  projectPetrinautReplayNetDefinition,
  reducePetrinautReplayExport,
} from '../petrinaut/replay-export.js';
import { parseSdcpnFile, petriTopologyToSdcpnFile, SDCPN_FILE_FORMAT_VERSION } from '../petrinaut/sdcpn.js';
import { serializePetrinautSseFrame, serializePetrinautSseFrames } from '../petrinaut/sse.js';
import { foldPetrinautStreamFrames, projectPetrinautStreamFrames } from '../petrinaut/stream-frames.js';
import { populatedPlanPath } from '../populate.js';
import { reportsPath } from '../report.js';
import { withRunExecutionAuthority } from '../run-execution-authority.js';
import { runDirPath, runMetadataPath } from '../run.js';

const sdcpnFileSchema = z.object({
  version: z.number().int().min(1).max(SDCPN_FILE_FORMAT_VERSION),
  meta: z.object({ generator: z.literal('brunch'), generatorVersion: z.string().optional() }),
  title: z.string().min(1),
  places: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      x: z.number(),
      y: z.number(),
      colorId: z.null(),
      dynamicsEnabled: z.literal(false),
      differentialEquationId: z.null(),
    }),
  ),
  transitions: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      x: z.number(),
      y: z.number(),
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
  it('refuses standalone export while the run execution owner is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-export-contended-'));
    await createCompletedRun(cwd);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const owner = withRunExecutionAuthority({ cwd, runId: 'run-1', execute: () => held });

    await expect(exportPetri({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'run_execution_active',
      runStatus: 'not_started',
      runId: 'run-1',
      sideEffects: [],
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    release();
    await owner;
  });

  it('prepares replay-identical observer artifacts before execution without advancing or truncating the run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-observation-prepare-'));
    const runDir = runDirPath(cwd, 'run-1');
    const planPath = join(cwd, 'plan.yaml');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      planPath,
      JSON.stringify({ mode: 'greenfield', slices: [{ id: 'task-1', depends_on: [] }] }),
      'utf8',
    );
    const createdMetadata = { runId: 'run-1', specId: '42', planPath, status: 'created' } as const;
    await writeFile(runMetadataPath(cwd, 'run-1'), JSON.stringify(createdMetadata), 'utf8');

    await preparePetriObservation({ cwd, runId: 'run-1' });
    const preparedNet = await readFile(petriNetPath(cwd, 'run-1'), 'utf8');
    const preparedSdcpn = await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8');

    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toEqual({
      ...createdMetadata,
      petriObservationPrepared: true,
    });
    expect(await readFile(petriEventsPath(cwd, 'run-1'), 'utf8')).toBe('');

    const existingEvent = {
      kind: 'net_halted',
      runId: 'run-1',
      runStatus: 'created',
      reason: 'existing event',
      failedSliceIds: [],
    } as const;
    const appended = await appendPetriEvent({ cwd, runId: 'run-1', event: existingEvent });
    await writeFile(
      planPath,
      JSON.stringify({ mode: 'greenfield', slices: [{ id: 'changed-task' }] }),
      'utf8',
    );
    await preparePetriObservation({ cwd, runId: 'run-1' });
    expect(await readFile(petriEventsPath(cwd, 'run-1'), 'utf8')).toBe(`${JSON.stringify(appended)}\n`);
    expect(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')).toBe(preparedNet);

    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ ...createdMetadata, status: 'run_completed' }),
      'utf8',
    );
    expect((await exportPetri({ cwd, runId: 'run-1' })).status).toBe('petri_exported');
    expect(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')).toBe(preparedNet);
    expect(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8')).toBe(preparedSdcpn);
  });

  it('does not mark observation prepared when initial journal creation fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-observation-marker-failure-'));
    const runDir = runDirPath(cwd, 'run-1');
    const planPath = join(cwd, 'plan.yaml');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      planPath,
      JSON.stringify({ mode: 'greenfield', slices: [{ id: 'task-1', depends_on: [] }] }),
      'utf8',
    );
    const createdMetadata = { runId: 'run-1', specId: '42', planPath, status: 'created' } as const;
    await writeFile(runMetadataPath(cwd, 'run-1'), JSON.stringify(createdMetadata), 'utf8');
    await mkdir(petriEventsPath(cwd, 'run-1'), { recursive: true });

    await expect(preparePetriObservation({ cwd, runId: 'run-1' })).rejects.toThrow(
      'Petrinaut journal is unavailable',
    );
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toEqual(createdMetadata);

    await rm(petriEventsPath(cwd, 'run-1'), { recursive: true });
  });

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
    const projectedPlaceIds = new Set(
      topology.transitions.flatMap((transition) =>
        [...transition.inputArcs, ...transition.outputArcs].map((arc) => arc.placeId),
      ),
    );
    for (const [placeId, count] of Object.entries(topology.initialMarking)) {
      if (count > 0) projectedPlaceIds.add(placeId);
    }
    expect(sdcpnFile.places.map((place: { readonly id: string }) => place.id).sort()).toEqual(
      [...projectedPlaceIds].sort(),
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
        'agent_result:task-1:attempt:1',
        'test_result_ingested:task-1:attempt:1',
        'verify_passed:task-1:attempt:1',
        'slice_integrate:task-1',
        'slice_complete:task-1',
        'slice_start:task-2',
        'slice_execute:task-2',
        'agent_result:task-2:attempt:1',
        'test_result_ingested:task-2:attempt:1',
        'verify_passed:task-2:attempt:1',
        'slice_integrate:task-2',
        'slice_complete:task-2',
        'epic_integrate:frontier-1',
        'epic_complete:frontier-1',
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
      firedTransitionCount: 24,
      terminalEventKind: 'net_completed',
    });
  });
});

describe('attempt facts', () => {
  it('replays an attempt-bearing journal without corrupting eligibility or marking', () => {
    const net = {
      initialMarking: { 'run:created': 1 },
      transitions: [
        {
          id: 'worktree_create',
          inputArcs: [{ placeId: 'run:created', weight: 1 }],
          outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
        },
      ],
    };
    const fired: ExecutorNetEvent = {
      kind: 'transition_fired',
      ts: '2026-07-14T12:00:00.000Z',
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
    };
    const attempt = parsePetriEvent({
      kind: 'attempt_failed',
      ts: '2026-07-14T12:00:01.000Z',
      runId: 'run-1',
      runStatus: 'slice_execution_requested',
      sliceId: 'task-1',
      step: 'agent_result',
      attempt: 1,
      reason: 'agent_run_failed',
    });
    expect(attempt).toBeDefined();
    const terminal: ExecutorNetEvent = {
      kind: 'net_completed',
      ts: '2026-07-14T12:00:02.000Z',
      runId: 'run-1',
      runStatus: 'promotion_prepared',
      failedSliceIds: [],
    };

    const withAttempts = replayPetri({ net, events: [fired, attempt!, terminal] });
    const withoutAttempts = replayPetri({ net, events: [fired, terminal] });

    expect(withAttempts).toEqual(withoutAttempts);
    expect(withAttempts).toMatchObject({
      currentMarking: { 'run:worktree_created': 1 },
      firedTransitionCount: 1,
      terminalEventKind: 'net_completed',
    });
  });

  it('rejects malformed attempt facts at the parse boundary', () => {
    const base = {
      kind: 'attempt_failed',
      runId: 'run-1',
      runStatus: 'slice_execution_requested',
      sliceId: 'task-1',
      step: 'agent_result',
      attempt: 1,
      reason: 'agent_run_failed',
    };
    expect(parsePetriEvent({ ...base, attempt: 0 })).toBeUndefined();
    expect(parsePetriEvent({ ...base, attempt: 1.5 })).toBeUndefined();
    expect(parsePetriEvent({ ...base, step: 'not_a_step' })).toBeUndefined();
    expect(parsePetriEvent({ ...base, sliceId: undefined })).toBeUndefined();
    expect(parsePetriEvent({ ...base, reason: 7 })).toBeUndefined();
  });
});

describe('appendPetriEvent', () => {
  it('stamps one durable ISO timestamp and publishes the same event object after append', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-append-timestamp-'));
    const seen: ExecutorNetEvent[] = [];
    const unsubscribe = subscribePetriEvents({ cwd, runId: 'run-1', listener: (event) => seen.push(event) });

    const appended = await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'net_completed',
        runId: 'run-1',
        runStatus: 'promotion_prepared',
        failedSliceIds: [],
      },
    });
    unsubscribe();

    const journal = await readPetriJournal(petriEventsPath(cwd, 'run-1'));
    expect(journal).toEqual({ status: 'readable', events: [appended] });
    expect(seen).toEqual([appended]);
    expect(seen[0]).toBe(appended);
    expect(new Date(appended.ts).toISOString()).toBe(appended.ts);
  });

  it('rejects timestamp-less and invalidly timestamped durable events', () => {
    const terminal = {
      kind: 'net_completed',
      runId: 'run-1',
      runStatus: 'promotion_prepared',
      failedSliceIds: [],
    };
    expect(parsePetriEvent(terminal)).toBeUndefined();
    expect(parsePetriEvent({ ...terminal, ts: 'not-a-date' })).toBeUndefined();
    expect(parsePetriEvent({ ...terminal, ts: '2026-07-14T12:00:00.000Z' })).toBeDefined();
  });

  it('fails closed when append-once proposes a terminal conflicting with durable truth', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-terminal-conflict-'));
    const durable = await appendPetriTerminalOnce({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'test_result_ingested',
        reason: 'slice_verification_not_passed',
        failedSliceIds: ['S3'],
      },
    });

    await expect(
      appendPetriTerminalOnce({
        cwd,
        runId: 'run-1',
        event: {
          kind: 'net_completed',
          runId: 'run-1',
          runStatus: 'promotion_prepared',
          failedSliceIds: [],
        },
      }),
    ).rejects.toThrow('petri_terminal_conflict');
    await expect(readPetriJournal(petriEventsPath(cwd, 'run-1'))).resolves.toEqual({
      status: 'readable',
      events: [durable],
    });
  });

  it('rejects a failed durable append, keeps success listeners silent, and wakes failure listeners run-scoped', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-append-failure-'));
    // Occupy the journal path with a directory so appendFile fails (EISDIR).
    await mkdir(petriEventsPath(cwd, 'run-1'), { recursive: true });
    const successKinds: string[] = [];
    let failureWakeUps = 0;
    let otherRunFailureWakeUps = 0;
    const unsubscribes = [
      subscribePetriEvents({ cwd, runId: 'run-1', listener: (event) => successKinds.push(event.kind) }),
      subscribePetriJournalFailures({
        cwd,
        runId: 'run-1',
        listener: () => {
          failureWakeUps += 1;
        },
      }),
      subscribePetriJournalFailures({
        cwd,
        runId: 'run-2',
        listener: () => {
          otherRunFailureWakeUps += 1;
        },
      }),
    ];

    try {
      await expect(
        appendPetriEvent({
          cwd,
          runId: 'run-1',
          event: {
            kind: 'net_completed',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            failedSliceIds: [],
          },
        }),
      ).rejects.toThrow();
    } finally {
      for (const unsubscribe of unsubscribes) unsubscribe();
    }

    expect(successKinds).toEqual([]);
    expect(failureWakeUps).toBe(1);
    expect(otherRunFailureWakeUps).toBe(0);
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
  it('rejects the raw journal when it contains contradictory terminal events', () => {
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
            ts: '2026-07-14T12:00:00.000Z',
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
          {
            kind: 'net_completed',
            ts: '2026-07-14T12:00:01.000Z',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            failedSliceIds: [],
          },
          {
            kind: 'net_deadlocked',
            ts: '2026-07-14T12:00:02.000Z',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            failedSliceIds: [],
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('rejects the raw journal when it fires again after a terminal event', () => {
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
            ts: '2026-07-14T12:00:00.000Z',
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
            kind: 'net_completed',
            ts: '2026-07-14T12:00:01.000Z',
            runId: 'run-1',
            runStatus: 'worktree_created',
            failedSliceIds: [],
          },
          {
            kind: 'transition_fired',
            ts: '2026-07-14T12:00:02.000Z',
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
    ).toBeUndefined();
  });

  it.each([
    {
      kind: 'attempt_failed' as const,
      ts: '2026-07-14T12:00:02.000Z',
      runId: 'run-1',
      runStatus: 'slice_execution_requested' as const,
      sliceId: 'task-1',
      step: 'agent_result' as const,
      attempt: 1,
      reason: 'agent_run_failed',
    },
    {
      kind: 'epic_verification_claimed' as const,
      ts: '2026-07-14T12:00:02.000Z',
      runId: 'run-1',
      runStatus: 'slice_completed' as const,
      epicId: 'epic-1',
      step: 'epic_verify' as const,
    },
  ])('rejects $kind after a terminal event', (postTerminalEvent) => {
    expect(
      replayPetri({
        net: { initialMarking: {}, transitions: [] },
        events: [
          {
            kind: 'net_completed',
            ts: '2026-07-14T12:00:01.000Z',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            failedSliceIds: [],
          },
          postTerminalEvent,
        ],
      }),
    ).toBeUndefined();
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
            ts: '2026-07-14T12:00:00.000Z',
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
            kind: 'net_halted',
            ts: '2026-07-14T12:00:01.000Z',
            runId: 'run-1',
            runStatus: 'worktree_created',
            failedSliceIds: [],
          },
        ],
      }),
    ).toEqual({
      currentMarking: { 'run:worktree_created': 1 },
      firedTransitionCount: 1,
    });
  });
});

describe('replayTransitionHistory', () => {
  it('separates verify result ingestion from the explicit pass/fail verdict branches', () => {
    const topology = compileExecutorTopology({ slices: [{ id: 'S3' }, { id: 'S5' }] });
    const transitions = new Map(topology.transitions.map((transition) => [transition.id, transition]));

    expect(transitions.has('test_result:S3:attempt:1')).toBe(false);
    expect(transitions.get('test_result_ingested:S3:attempt:1')).toMatchObject({
      inputArcs: [{ placeId: 'slice:S3:verify_attempt:1', weight: 1 }],
      outputArcs: [{ placeId: 'slice:S3:verify_result:1', weight: 1 }],
    });
    expect(transitions.get('verify_failed:S3:attempt:1')).toMatchObject({
      inputArcs: [{ placeId: 'slice:S3:verify_result:1', weight: 1 }],
      outputArcs: [{ placeId: 'slice:S3:verification_failed', weight: 1 }],
    });
    expect(transitions.get('verify_passed:S5:attempt:1')).toMatchObject({
      inputArcs: [{ placeId: 'slice:S5:verify_result:1', weight: 1 }],
      outputArcs: [{ placeId: 'slice:S5:verification_passed', weight: 1 }],
    });
    expect(transitions.get('slice_integrate:S3')).toMatchObject({
      inputArcs: [{ placeId: 'slice:S3:verification_passed', weight: 1 }],
    });

    const prefix = ['worktree_create', 'populate', 'source_policy', 'source_copy', 'report_init'];
    const failed = replayTransitionHistory(topology, [
      ...prefix,
      'slice_start:S3',
      'slice_execute:S3',
      'agent_result:S3:attempt:1',
      'test_result_ingested:S3:attempt:1',
      'verify_failed:S3:attempt:1',
    ]);
    expect(failed?.currentMarking).toMatchObject({
      'slice:S3:verification_failed': 1,
      'slice:S5:claim': 1,
    });
    expect(failed?.currentMarking).not.toHaveProperty('slice:S3:verification_passed');
    expect(
      replayTransitionHistory(topology, [
        ...prefix,
        'slice_start:S3',
        'slice_execute:S3',
        'agent_result:S3:attempt:1',
        'test_result_ingested:S3:attempt:1',
        'verify_failed:S3:attempt:1',
        'slice_integrate:S3',
      ]),
    ).toBeUndefined();
  });

  it('replays connected attempt retry and exhaustion markings without changing topology', () => {
    const topology = compileExecutorTopology({ slices: [{ id: 'task-1' }] });
    const prefix = [
      'worktree_create',
      'populate',
      'source_policy',
      'source_copy',
      'report_init',
      'slice_start:task-1',
      'slice_execute:task-1',
    ];

    expect(replayTransitionHistory(topology, prefix)?.currentMarking).toEqual({
      'slice:task-1:agent_attempt:1': 1,
    });
    expect(replayTransitionHistory(topology, [...prefix, 'agent_retry:task-1:1'])?.currentMarking).toEqual({
      'slice:task-1:agent_attempt:2': 1,
    });
    expect(
      replayTransitionHistory(topology, [
        ...prefix,
        'agent_retry:task-1:1',
        'agent_retry:task-1:2',
        'agent_exhausted:task-1',
      ])?.currentMarking,
    ).toEqual({ 'slice:task-1:agent_attempts_exhausted': 1 });
  });

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
        'agent_result:task-2:attempt:1',
      ]),
    ).toEqual({
      currentMarking: {
        'slice:task-1:claim': 1,
        'slice:task-2:verify_attempt:1': 1,
      },
      firedTransitionCount: 8,
    });

    expect(replayTransitionHistory(topology, ['missing-transition'])).toBeUndefined();
  });

  it('joins epic members through optional verification and blocks dependent epic claims until completion', () => {
    const topology = compileExecutorTopology({
      epics: [
        {
          id: 'epic-1',
          verification: [{ kind: 'criterion', target: 'epic one works' }],
        },
        { id: 'epic-2', depends_on: ['epic-1'], verification: [] },
      ],
      slices: [
        { id: 'task-1', epic_id: 'epic-1' },
        { id: 'task-2', epic_id: 'epic-1' },
        { id: 'task-3', epic_id: 'epic-2' },
      ],
    });
    const beforeCompletion = replayTransitionHistory(topology, [
      'worktree_create',
      'populate',
      'source_policy',
      'source_copy',
      'report_init',
      'slice_start:task-1',
      'slice_execute:task-1',
      'agent_result:task-1:attempt:1',
      'test_result_ingested:task-1:attempt:1',
      'verify_passed:task-1:attempt:1',
      'slice_integrate:task-1',
      'slice_complete:task-1',
      'slice_start:task-2',
      'slice_execute:task-2',
      'agent_result:task-2:attempt:1',
      'test_result_ingested:task-2:attempt:1',
      'verify_passed:task-2:attempt:1',
      'slice_integrate:task-2',
      'slice_complete:task-2',
    ]);

    expect(beforeCompletion?.currentMarking).not.toHaveProperty('slice:task-3:epic_dependency:epic-1');
    expect(
      replayTransitionHistory(topology, [
        'worktree_create',
        'populate',
        'source_policy',
        'source_copy',
        'report_init',
        'slice_start:task-1',
        'slice_execute:task-1',
        'agent_result:task-1:attempt:1',
        'test_result_ingested:task-1:attempt:1',
        'verify_passed:task-1:attempt:1',
        'slice_integrate:task-1',
        'slice_complete:task-1',
        'slice_start:task-2',
        'slice_execute:task-2',
        'agent_result:task-2:attempt:1',
        'test_result_ingested:task-2:attempt:1',
        'verify_passed:task-2:attempt:1',
        'slice_integrate:task-2',
        'slice_complete:task-2',
        'epic_integrate:epic-1',
        'epic_verify:epic-1',
        'epic_complete:epic-1',
      ])?.currentMarking,
    ).toMatchObject({
      'slice:task-3:claim': 1,
      'slice:task-3:epic_dependency:epic-1': 1,
      'epic:epic-1:completed': 1,
    });
    expect(topology.transitions.map((transition) => transition.id)).toEqual(
      expect.arrayContaining([
        'epic_integrate:epic-1',
        'epic_verify:epic-1',
        'epic_complete:epic-1',
        'epic_integrate:epic-2',
        'epic_complete:epic-2',
      ]),
    );
    expect(topology.transitions.map((transition) => transition.id)).not.toContain('epic_verify:epic-2');
  });
});

describe('reducePetrinautReplayExport', () => {
  it('projects only connected or initially marked places without changing raw topology', () => {
    const compiled = compileExecutorTopology({ slices: [{ id: 'S3', definition: 'Build parser' }] });
    const topology = {
      ...compiled,
      places: [
        ...compiled.places,
        { id: 'view:isolated', subnetId: 'run', name: 'Isolated' },
        { id: 'view:marked', subnetId: 'run', name: 'Marked frontier' },
      ],
      initialMarking: { ...compiled.initialMarking, 'view:marked': 1 },
    };
    const before = structuredClone(topology);

    const sdcpn = petriTopologyToSdcpnFile({ runId: 'run-1', topology });
    const projectedPlaceIds = new Set(sdcpn.places.map((place) => place.id));
    const incidentPlaceIds = new Set(
      sdcpn.transitions.flatMap((transition) =>
        [...transition.inputArcs, ...transition.outputArcs].map((arc) => arc.placeId),
      ),
    );

    expect(topology).toEqual(before);
    expect(projectedPlaceIds.has('view:isolated')).toBe(false);
    expect(projectedPlaceIds.has('view:marked')).toBe(true);
    expect([...incidentPlaceIds].every((placeId) => projectedPlaceIds.has(placeId))).toBe(true);
    expect(sdcpn.transitions.map(({ id, inputArcs, outputArcs }) => ({ id, inputArcs, outputArcs }))).toEqual(
      topology.transitions.map(({ id, inputArcs, outputArcs }) => ({
        id,
        inputArcs: inputArcs.map((arc) => ({ ...arc, type: 'standard' })),
        outputArcs,
      })),
    );
  });

  it('retains the connected empty-plan frontier and gives every node deterministic finite coordinates', () => {
    const topology = compileExecutorTopology({ slices: [] });
    const first = petriTopologyToSdcpnFile({ runId: 'run-empty', topology });
    const second = petriTopologyToSdcpnFile({ runId: 'run-empty', topology });

    expect(first.places.map((place) => place.id)).toContain('run:slice_frontier');
    expect(first).toEqual(second);
    for (const node of [...first.places, ...first.transitions]) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('uses stable semantic columns and sorted compact bands regardless of plan array order', () => {
    const plan = {
      epics: [
        { id: 'E2', summary: 'Ship UI', depends_on: ['E1'], verification: [] },
        { id: 'E1', summary: 'Build core', depends_on: [], verification: [] },
      ],
      slices: [
        { id: 'S5', epic_id: 'E2', definition: 'Ship keyboard flow' },
        { id: 'S4', epic_id: 'E1', definition: 'Verify parser' },
        { id: 'S3', epic_id: 'E1', definition: 'Build parser' },
      ],
    } as const;
    const reordered = {
      epics: [...plan.epics].reverse(),
      slices: [...plan.slices].reverse(),
    };
    const first = petriTopologyToSdcpnFile({
      runId: 'run-mrkj5qqo',
      topology: compileExecutorTopology(plan),
    });
    const second = petriTopologyToSdcpnFile({
      runId: 'run-mrkj5qqo',
      topology: compileExecutorTopology(reordered),
    });
    const placement = (file: typeof first) =>
      Object.fromEntries(
        [...file.places, ...file.transitions]
          .map((node) => [node.id, { name: node.name, x: node.x, y: node.y }] as const)
          .sort(([left], [right]) => left.localeCompare(right)),
      );

    expect(placement(first)).toEqual(placement(second));
    expect(first.places.find((place) => place.id === 'slice:S3:agent_attempt:1')?.name).toContain(
      'S3 · Agent attempt 1',
    );
    expect(first.transitions.find((transition) => transition.id === 'epic_integrate:E1')?.name).toContain(
      'E1 · Integrate epic',
    );

    for (const sliceId of ['S3', 'S4', 'S5']) {
      const sliceNodes = [...first.places, ...first.transitions].filter(
        (node) =>
          node.id.startsWith(`slice:${sliceId}:`) ||
          (!node.id.startsWith('epic:') && node.id.includes(`:${sliceId}`)),
      );
      const ys = sliceNodes.map((node) => node.y!);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(240);
    }

    const nodes = [...first.places, ...first.transitions];
    const xs = nodes.map((node) => node.x!);
    const ys = nodes.map((node) => node.y!);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(6_000);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(3_000);
  });

  it('allocates a unique coordinate to every run-mrkj5qqo-shaped projected node', () => {
    const topology = compileExecutorTopology({
      epics: [
        { id: 'E1', summary: 'Build core', depends_on: [], verification: [] },
        { id: 'E2', summary: 'Ship UI', depends_on: ['E1'], verification: [] },
      ],
      slices: [
        { id: 'S3', epic_id: 'E1', definition: 'Build parser' },
        { id: 'S4', epic_id: 'E1', definition: 'Verify parser', depends_on: ['S3'] },
        { id: 'S5', epic_id: 'E2', definition: 'Ship keyboard flow', depends_on: ['S3', 'S4'] },
      ],
    });
    const file = petriTopologyToSdcpnFile({ runId: 'run-mrkj5qqo', topology });
    const nodes = [...file.places, ...file.transitions];
    const ids = nodes.map((node) => node.id);

    expect(ids.some((id) => id.includes(':dependency:'))).toBe(true);
    expect(ids.some((id) => id.endsWith(':verification_passed'))).toBe(true);
    expect(ids.some((id) => id.endsWith(':verification_failed'))).toBe(true);
    expect(ids.some((id) => id.includes(':member:'))).toBe(true);
    expect(new Set(nodes.map((node) => `${node.x}/${node.y}`))).toHaveLength(nodes.length);
  });

  it('uses locale-independent natural ID order for semantic bands and fallback coordinates', () => {
    const topology = compileExecutorTopology({
      slices: [
        { id: 'S10', definition: 'Later' },
        { id: 'S2', definition: 'Earlier' },
      ],
    });
    const file = petriTopologyToSdcpnFile({ runId: 'run-natural-order', topology });
    const s2 = file.places.find((place) => place.id === 'slice:S2:claim')!;
    const s10 = file.places.find((place) => place.id === 'slice:S10:claim')!;
    expect(s2.y).toBeLessThan(s10.y!);

    const legacy = structuredClone(file);
    const legacyS2 = legacy.places.find((place) => place.id === 'slice:S2:claim') as {
      x?: number;
      y?: number;
    };
    const legacyS10 = legacy.places.find((place) => place.id === 'slice:S10:claim') as {
      x?: number;
      y?: number;
    };
    delete legacyS2.x;
    delete legacyS2.y;
    delete legacyS10.x;
    delete legacyS10.y;
    const definition = projectPetrinautReplayNetDefinition(legacy);
    const fallbackIndex = (id: string) => {
      const place = definition.places.find((candidate) => candidate.id === id)!;
      return place.y * 10_000 + place.x;
    };
    expect(fallbackIndex('slice:S2:claim')).toBeLessThan(fallbackIndex('slice:S10:claim'));
  });

  it('allocates mixed legacy fallback coordinates around every explicit occupied coordinate', () => {
    const sdcpn = petriTopologyToSdcpnFile({
      runId: 'run-legacy-coordinate-collision',
      topology: compileExecutorTopology({ slices: [] }),
    });
    const legacy = structuredClone(sdcpn);
    for (const node of [...legacy.places, ...legacy.transitions]) {
      delete (node as { x?: number }).x;
      delete (node as { y?: number }).y;
    }
    const explicit = legacy.places[0] as { x?: number; y?: number };
    explicit.x = 260;
    explicit.y = 80;

    const first = projectPetrinautReplayNetDefinition(legacy);
    const second = projectPetrinautReplayNetDefinition(legacy);
    const positions = [...first.places, ...first.transitions].map(({ x, y }) => `${x}/${y}`);

    expect(first).toEqual(second);
    expect(new Set(positions)).toHaveLength(positions.length);
    expect(positions.filter((position) => position === '260/80')).toHaveLength(1);
  });

  it('accepts full SDCPN roots while enforcing the projected staging basics', () => {
    const generated = structuredClone(
      petriTopologyToSdcpnFile({
        runId: 'run-parse-contract',
        topology: compileExecutorTopology({ slices: [] }),
      }),
    );
    const valid = {
      ...generated,
      types: [{ id: 'token-type' }],
      parameters: [{ id: 'rate' }],
    };
    expect(parseSdcpnFile(valid)).toBeDefined();

    const invalidCandidates = [
      { ...valid, version: 0 },
      { ...valid, title: '' },
      { ...valid, meta: { ...valid.meta, generator: '' } },
      { ...valid, places: [{ ...valid.places[0]!, id: '' }, ...valid.places.slice(1)] },
      { ...valid, places: [{ ...valid.places[0]!, name: '' }, ...valid.places.slice(1)] },
      { ...valid, transitions: [{ ...valid.transitions[0]!, id: '' }, ...valid.transitions.slice(1)] },
      { ...valid, transitions: [{ ...valid.transitions[0]!, name: '' }, ...valid.transitions.slice(1)] },
      { ...valid, places: [{ ...valid.places[0]!, x: Number.NaN }, ...valid.places.slice(1)] },
    ];
    for (const candidate of invalidCandidates) expect(parseSdcpnFile(candidate)).toBeUndefined();
  });

  it('preserves projected coordinates and names while replaying run-mrkj5qqo-shaped failed branches', () => {
    const topology = compileExecutorTopology({ slices: [{ id: 'S3' }, { id: 'S4' }, { id: 'S5' }] });
    const sdcpnFile = petriTopologyToSdcpnFile({ runId: 'run-mrkj5qqo', topology });
    const transitions = new Map(topology.transitions.map((transition) => [transition.id, transition]));
    const ids = [
      'worktree_create',
      'populate',
      'source_policy',
      'source_copy',
      'report_init',
      'slice_start:S3',
      'slice_start:S4',
      'slice_start:S5',
      'slice_execute:S3',
      'agent_result:S3:attempt:1',
      'test_result_ingested:S3:attempt:1',
      'verify_failed:S3:attempt:1',
      'slice_execute:S4',
      'agent_result:S4:attempt:1',
      'test_result_ingested:S4:attempt:1',
      'verify_failed:S4:attempt:1',
      'slice_execute:S5',
      'agent_result:S5:attempt:1',
      'test_result_ingested:S5:attempt:1',
      'verify_passed:S5:attempt:1',
      'slice_integrate:S5',
    ];
    const events = ids.map((transitionId, index): ExecutorNetEvent => {
      const transition = transitions.get(transitionId)!;
      return {
        kind: 'transition_fired',
        ts: `2026-07-14T12:00:${String(index).padStart(2, '0')}.000Z`,
        runId: 'run-mrkj5qqo',
        runStatus: 'slice_completed',
        transitionId,
        subnetId: transition.subnetId,
        step: transition.step?.kind ?? 'test_result',
        contract: transition.contract,
        consumed: transition.inputArcs.map((arc) => arc.placeId),
        produced: transition.outputArcs.map((arc) => arc.placeId),
        fromStatus: 'test_result_ingested',
        toStatus: 'slice_completed',
      };
    });
    events.push({
      kind: 'net_halted',
      ts: '2026-07-14T12:00:21.000Z',
      runId: 'run-mrkj5qqo',
      runStatus: 'slice_completed',
      reason: 'slice_verification_not_passed',
      failedSliceIds: ['S3', 'S4'],
    });

    const replay = reducePetrinautReplayExport({ sdcpnFile, events });
    expect(replay.definition).toEqual(
      expect.objectContaining({
        places: expect.arrayContaining([
          expect.objectContaining({
            id: 'slice:S3:verification_failed',
            name: expect.stringContaining('S3'),
            x: expect.any(Number),
            y: expect.any(Number),
          }),
        ]),
      }),
    );
    expect(replay.transitionFirings.map((firing) => firing.transitionId)).toEqual([
      ...ids,
      PETRI_RUN_FINISH_TRANSITION,
    ]);
    expect(replay.transitionFirings.slice(0, -1).map((firing) => Object.keys(firing))).toEqual(
      ids.map(() => ['transitionId', 'input', 'output', 'ts']),
    );
  });

  it('preserves optional coordinates when projecting an SDCPN definition', () => {
    const topology = compileExecutorTopology({ slices: [{ id: 'S3' }] });
    const sdcpn = petriTopologyToSdcpnFile({ runId: 'run-1', topology });
    const definition = projectPetrinautReplayNetDefinition(sdcpn);

    expect(definition.places[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(definition.transitions[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });

  it('matches the origin/main firing contract and reuses the terminal event timestamp', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-origin-main-contract-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    const transitionTs = '2026-07-14T12:00:00.000Z';
    const terminalTs = '2026-07-14T12:00:01.000Z';

    const payload = reducePetrinautReplayExport({
      sdcpnFile,
      events: [
        {
          kind: 'transition_fired',
          ts: transitionTs,
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
          kind: 'net_completed',
          ts: terminalTs,
          runId: 'run-1',
          runStatus: 'promotion_prepared',
          failedSliceIds: [],
        },
      ],
    });

    expect(payload.transitionFirings).toEqual([
      {
        transitionId: 'worktree_create',
        input: { 'run:created': 1 },
        output: { 'run:worktree_created': 1 },
        ts: transitionTs,
      },
      {
        transitionId: PETRI_RUN_FINISH_TRANSITION,
        input: {},
        output: { [PETRI_RUN_COMPLETED_PLACE]: 1 },
        ts: terminalTs,
      },
    ]);
    expect(Object.keys(payload.transitionFirings[0]!)).toEqual(['transitionId', 'input', 'output', 'ts']);
  });

  it('keeps failed-attempt facts and retry markings in truthful projection order', () => {
    const topology = compileExecutorTopology({ slices: [{ id: 'task-1' }] });
    const sdcpnFile = petriTopologyToSdcpnFile({ runId: 'run-1', topology });
    const transitions = new Map(topology.transitions.map((transition) => [transition.id, transition]));
    const fired = (transitionId: string, step: 'slice_execute' | 'agent_result'): ExecutorNetEvent => {
      const transition = transitions.get(transitionId)!;
      return {
        kind: 'transition_fired',
        ts: '2026-07-14T12:00:00.000Z',
        runId: 'run-1',
        runStatus: 'slice_execution_requested',
        transitionId,
        subnetId: transition.subnetId,
        step,
        contract: transition.contract,
        consumed: transition.inputArcs.map((arc) => arc.placeId),
        produced: transition.outputArcs.map((arc) => arc.placeId),
        fromStatus: 'slice_execution_requested',
        toStatus: 'slice_execution_requested',
      };
    };

    const payload = reducePetrinautReplayExport({
      sdcpnFile,
      events: [
        fired('slice_execute:task-1', 'slice_execute'),
        {
          kind: 'attempt_failed',
          ts: '2026-07-14T12:00:00.500Z',
          runId: 'run-1',
          runStatus: 'slice_execution_requested',
          sliceId: 'task-1',
          step: 'agent_result',
          attempt: 1,
          reason: 'agent_run_failed',
        },
        fired('agent_retry:task-1:1', 'agent_result'),
        fired('agent_result:task-1:attempt:2', 'agent_result'),
      ],
    });

    expect(payload.transitionFirings.map((firing) => firing.transitionId)).toEqual([
      'slice_execute:task-1',
      'agent_retry:task-1:1',
      'agent_result:task-1:attempt:2',
    ]);
    expect(payload.transitionFirings[1]).toMatchObject({
      input: { 'slice:task-1:agent_attempt:1': 1 },
      output: { 'slice:task-1:agent_attempt:2': 1 },
    });
  });

  it('projects SDCPN plus journal events into a compact Petrinaut replay payload', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-replay-export-'));
    await createCompletedRun(cwd);
    await exportPetri({ cwd, runId: 'run-1' });
    const sdcpnFile = JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8'));
    const events: ExecutorNetEvent[] = [
      {
        kind: 'transition_fired',
        ts: '2026-07-14T12:00:00.000Z',
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
        ts: '2026-07-14T12:00:01.000Z',
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
      {
        kind: 'net_completed',
        ts: '2026-07-14T12:00:02.000Z',
        runId: 'run-1',
        runStatus: 'promotion_prepared',
        failedSliceIds: [],
      },
    ];

    const payload = reducePetrinautReplayExport({ sdcpnFile, events });

    expect(payload.initialState).toEqual({ 'run:created': 1 });
    expect(payload.definition.places).toContainEqual(
      expect.objectContaining({
        id: PETRI_RUN_COMPLETED_PLACE,
        name: 'Run · Completed',
        x: 4_700,
        y: 40,
      }),
    );
    expect(payload.definition.places).toContainEqual(
      expect.objectContaining({ id: PETRI_RUN_HALTED_PLACE, name: 'Run · Halted', x: 4_700, y: 120 }),
    );
    expect(payload.definition.transitions).toContainEqual(
      expect.objectContaining({
        id: PETRI_RUN_FINISH_TRANSITION,
        name: 'Run · Finish',
        x: 4_600,
        y: 80,
        inputArcs: [],
        outputArcs: [
          { placeId: PETRI_RUN_COMPLETED_PLACE, weight: 1 },
          { placeId: PETRI_RUN_HALTED_PLACE, weight: 1 },
        ],
      }),
    );
    expect(payload.definition.transitions[0]).toEqual({
      id: 'worktree_create',
      name: 'Run · Worktree create',
      x: 180,
      y: 80,
      inputArcs: [{ placeId: 'run:created', weight: 1, type: 'standard' }],
      outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
    });
    expect(payload.transitionFirings).toEqual([
      {
        transitionId: 'worktree_create',
        input: { 'run:created': 1 },
        output: { 'run:worktree_created': 1 },
        ts: '2026-07-14T12:00:00.000Z',
      },
      {
        transitionId: 'populate',
        input: { 'run:worktree_created': 1 },
        output: { 'run:worktree_populated': 1 },
        ts: '2026-07-14T12:00:01.000Z',
      },
      {
        transitionId: PETRI_RUN_FINISH_TRANSITION,
        input: {},
        output: { [PETRI_RUN_COMPLETED_PLACE]: 1 },
        ts: '2026-07-14T12:00:02.000Z',
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
        events: [
          {
            kind: 'net_halted',
            ts: '2026-07-14T12:00:00.000Z',
            runId: 'run-1',
            runStatus: 'worktree_created',
            reason: 'boom',
            failedSliceIds: ['task-1'],
          },
        ],
      }).transitionFirings,
    ).toEqual([
      {
        transitionId: PETRI_RUN_FINISH_TRANSITION,
        input: {},
        output: { [PETRI_RUN_HALTED_PLACE]: 1 },
        ts: '2026-07-14T12:00:00.000Z',
      },
    ]);
    expect(
      reducePetrinautReplayExport({
        sdcpnFile,
        events: [
          {
            kind: 'net_deadlocked',
            ts: '2026-07-14T12:00:00.000Z',
            runId: 'run-1',
            runStatus: 'worktree_created',
            failedSliceIds: [],
          },
        ],
      }).transitionFirings,
    ).toEqual([
      {
        transitionId: PETRI_RUN_FINISH_TRANSITION,
        input: {},
        output: { [PETRI_RUN_HALTED_PLACE]: 1 },
        ts: '2026-07-14T12:00:00.000Z',
      },
    ]);
  });

  it.each([
    {
      kind: 'attempt_failed' as const,
      ts: '2026-07-14T12:00:01.000Z',
      runId: 'run-1',
      runStatus: 'slice_execution_requested' as const,
      sliceId: 'task-1',
      step: 'agent_result' as const,
      attempt: 1,
      reason: 'agent_run_failed',
    },
    {
      kind: 'epic_verification_claimed' as const,
      ts: '2026-07-14T12:00:01.000Z',
      runId: 'run-1',
      runStatus: 'slice_completed' as const,
      epicId: 'epic-1',
      step: 'epic_verify' as const,
    },
  ])('fails closed when $kind follows a Petrinaut terminal event', (postTerminalEvent) => {
    const sdcpnFile = petriTopologyToSdcpnFile({
      runId: 'run-1',
      topology: compileExecutorTopology({ slices: [] }),
    });
    expect(() =>
      reducePetrinautReplayExport({
        sdcpnFile,
        events: [
          {
            kind: 'net_completed',
            ts: '2026-07-14T12:00:00.000Z',
            runId: 'run-1',
            runStatus: 'promotion_prepared',
            failedSliceIds: [],
          },
          postTerminalEvent,
        ],
      }),
    ).toThrow(/after terminal event/);
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
            ts: '2026-07-14T12:00:00.000Z',
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
          ts: '2026-07-14T12:00:00.000Z',
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
    expect(frames[0]).toEqual({ kind: 'status', state: 'running', failedSliceIds: [] });
    expect(foldPetrinautStreamFrames(frames)).toEqual(replayExport);
    const definitionFrame = frames.find((frame) => frame.kind === 'definition');
    expect(petrinautBrunchDefinitionSchema.safeParse(definitionFrame?.definition).success).toBe(true);
  });

  it('mirrors strict staging definition rejection for unknown root, place, and transition keys', () => {
    const topology = compileExecutorTopology({ slices: [{ id: 'S1' }] });
    const definition = reducePetrinautReplayExport({
      sdcpnFile: petriTopologyToSdcpnFile({ runId: 'run-1', topology }),
      events: [],
    }).definition;
    const candidates = [
      { ...definition, unexpected: true },
      { ...definition, places: [{ ...definition.places[0]!, unexpected: true }] },
      { ...definition, transitions: [{ ...definition.transitions[0]!, unexpected: true }] },
      { ...definition, places: [{ ...definition.places[0]!, x: undefined }] },
      { ...definition, transitions: [{ ...definition.transitions[0]!, y: undefined }] },
    ];

    for (const candidate of candidates) {
      expect(petrinautBrunchDefinitionSchema.safeParse(candidate).success).toBe(false);
    }
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
      terminal: {
        state: 'halted',
        reason: 'promotion_failed',
        ts: '2026-07-14T12:00:00.000Z',
        failedSliceIds: ['S3'],
      },
    });

    expect(frames).toEqual([
      { kind: 'status', state: 'halted', reason: 'promotion_failed', failedSliceIds: ['S3'] },
      { kind: 'definition', definition: replayExport.definition },
      { kind: 'initial_state', initialState: {} },
      {
        kind: 'transition_firing',
        firing: {
          transitionId: PETRI_RUN_FINISH_TRANSITION,
          input: {},
          output: { [PETRI_RUN_HALTED_PLACE]: 1 },
          ts: '2026-07-14T12:00:00.000Z',
        },
      },
      { kind: 'terminal', state: 'halted', reason: 'promotion_failed', failedSliceIds: ['S3'] },
    ]);
  });
});

describe('Petrinaut SSE serialization', () => {
  it('serializes one frame as a named SSE event with one JSON data line and a blank terminator', () => {
    expect(
      serializePetrinautSseFrame({
        kind: 'status',
        state: 'halted',
        reason: 'promotion_failed',
        failedSliceIds: ['S3'],
      }),
    ).toBe('event: status\ndata: {"state":"halted","failedSliceIds":["S3"],"reason":"promotion_failed"}\n\n');
  });

  it('serializes each frame kind with the expected event name and JSON payload', () => {
    const frames = projectPetrinautStreamFrames({
      replayExport: {
        definition: {
          version: 1,
          meta: { generator: 'brunch' },
          title: 'run',
          places: [{ id: 'run:created', name: 'RunCreated', x: 80, y: 80 }],
          transitions: [],
        },
        initialState: { 'run:created': 1 },
        transitionFirings: [
          {
            transitionId: 'worktree_create',
            input: { 'run:created': 1 },
            output: { 'run:worktree_created': 1 },
            ts: '2026-07-14T12:00:00.000Z',
          },
        ],
      },
      terminal: { state: 'completed', ts: '2026-07-14T12:00:01.000Z', failedSliceIds: [] },
    });
    const chunks = serializePetrinautSseFrames(frames)
      .split('\n\n')
      .filter((chunk) => chunk.length > 0);

    expect(chunks.map((chunk) => chunk.split('\n')[0])).toEqual([
      'event: status',
      'event: definition',
      'event: initial_state',
      'event: transition_firing',
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
      ts: '2026-07-14T12:00:00.000Z',
    });
    expect(JSON.parse(chunks[4]!.split('\n')[1]!.slice('data: '.length))).toMatchObject({
      transitionId: PETRI_RUN_FINISH_TRANSITION,
      output: { [PETRI_RUN_COMPLETED_PLACE]: 1 },
    });
    expect(JSON.parse(chunks[5]!.split('\n')[1]!.slice('data: '.length))).toEqual({
      state: 'completed',
      failedSliceIds: [],
    });
  });

  it('batch serialization is exactly the concatenation of per-frame chunks', () => {
    const frames = [
      { kind: 'status' as const, state: 'running' as const, failedSliceIds: [] },
      { kind: 'initial_state' as const, initialState: { p1: 2 } },
    ];

    expect(serializePetrinautSseFrames(frames)).toBe(
      `${serializePetrinautSseFrame(frames[0]!)}${serializePetrinautSseFrame(frames[1]!)}`,
    );
  });
});
