import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { agentStreamPath } from '../agent-result.js';
import { listRuns, readRunDetail } from '../observer-read.js';
import { compileExecutorTopology, type ExecutorNetEvent } from '../orchestrate-topology.js';
import { petriTopologyToSdcpnFile } from '../petrinaut/sdcpn.js';
import { populatedPlanPath } from '../populate.js';
import { runDirPath, runMetadataPath, type RunMetadata } from '../run.js';
import { verifyStreamPath } from '../test-result.js';

async function fixtureCwd(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeRun(cwd: string, runId: string, metadata: Partial<RunMetadata>): Promise<string> {
  const runDir = runDirPath(cwd, runId);
  await mkdir(runDir, { recursive: true });
  const sliceAttemptHistory = { ...metadata.sliceAttemptHistory };
  for (const sliceId of metadata.completedSliceIds ?? []) {
    sliceAttemptHistory[sliceId] ??= {
      agent: [{ outcome: 'succeeded', attempts: 1 }],
      verify: [{ outcome: 'succeeded', attempts: 1, verdict: 'passed' }],
    };
  }
  const payload = {
    runId,
    specId: '42',
    planPath: '/plan.json',
    status: 'created',
    ...metadata,
    ...(Object.keys(sliceAttemptHistory).length === 0 ? {} : { sliceAttemptHistory }),
  };
  await writeFile(runMetadataPath(cwd, runId), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return runDir;
}

function minimalSdcpnFile() {
  return {
    version: 1,
    meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
    title: 'Executor run run-petri-live',
    places: [
      {
        id: 'run:created',
        name: 'RunCreated',
        colorId: null,
        dynamicsEnabled: false,
        differentialEquationId: null,
      },
      {
        id: 'run:worktree_created',
        name: 'RunWorktreeCreated',
        colorId: null,
        dynamicsEnabled: false,
        differentialEquationId: null,
      },
    ],
    transitions: [
      {
        id: 'worktree_create',
        name: 'worktree_create',
        inputArcs: [{ placeId: 'run:created', weight: 1, type: 'standard' }],
        outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
        lambdaType: 'predicate',
        lambdaCode: 'export default Lambda(() => true)',
        transitionKernelCode: 'export default TransitionKernel(() => ({}))',
      },
    ],
    types: [],
    differentialEquations: [],
    parameters: [],
    scenarios: [
      {
        id: 'scenario__initial-marking',
        name: 'Initial marking',
        scenarioParameters: [],
        parameterOverrides: {},
        initialState: { type: 'per_place', content: { 'run:created': '1' } },
      },
    ],
    metrics: [],
  };
}

function transitionEvent(
  overrides: Partial<Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }>> = {},
): Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }> {
  return {
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
    ...overrides,
  };
}

describe('listRuns', () => {
  it('returns an empty list when no runs directory exists', async () => {
    const cwd = await fixtureCwd('brunch-observer-empty-');
    expect(await listRuns(cwd)).toEqual([]);
  });

  it('summarizes readable runs with presence flags and marks torn metadata unreadable', async () => {
    const cwd = await fixtureCwd('brunch-observer-list-');
    const freshDir = await writeRun(cwd, 'run-a', { status: 'created' });
    await writeRun(cwd, 'run-b', { status: 'slice_started', activeSliceId: 's1' });
    await mkdir(join(runDirPath(cwd, 'run-b'), 'worktree'), { recursive: true });
    await writeFile(join(runDirPath(cwd, 'run-b'), 'reports.jsonl'), '{"event":"run_ready"}\n', 'utf8');
    const tornDir = runDirPath(cwd, 'run-c');
    await mkdir(tornDir, { recursive: true });
    await writeFile(join(tornDir, 'run.json'), '{"runId":"run-c","spec', 'utf8');

    const entries = await listRuns(cwd);

    expect(entries).toEqual([
      {
        runId: 'run-a',
        specId: '42',
        status: 'created',
        presence: { worktree: false, reports: false, petri: false, promotion: false },
      },
      {
        runId: 'run-b',
        specId: '42',
        status: 'slice_started',
        activeSliceId: 's1',
        presence: { worktree: true, reports: true, petri: false, promotion: false },
      },
      { runId: 'run-c', unreadable: true },
    ]);
    expect(freshDir).toContain('run-a');
  });

  it('marks invalid run directories unreadable instead of failing the full list', async () => {
    const cwd = await fixtureCwd('brunch-observer-invalid-dir-');
    await writeRun(cwd, 'run-a', { status: 'created' });
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'bad run id'), { recursive: true });

    expect(await listRuns(cwd)).toEqual([
      { runId: 'bad run id', unreadable: true },
      {
        runId: 'run-a',
        specId: '42',
        status: 'created',
        presence: { worktree: false, reports: false, petri: false, promotion: false },
      },
    ]);
  });

  it('surfaces replanning lineage and abandoned metadata in run summaries', async () => {
    const cwd = await fixtureCwd('brunch-observer-replan-summary-');
    await writeRun(cwd, 'run-a', {
      status: 'abandoned',
      supersedesRunId: 'run-old',
      abandonedAt: '2026-07-07T00:00:00.000Z',
      abandonReason: 'User chose a fresh plan',
    });

    expect(await listRuns(cwd)).toEqual([
      {
        runId: 'run-a',
        specId: '42',
        status: 'abandoned',
        supersedesRunId: 'run-old',
        abandonedAt: '2026-07-07T00:00:00.000Z',
        abandonReason: 'User chose a fresh plan',
        presence: { worktree: false, reports: false, petri: false, promotion: false },
      },
    ]);
  });
});

describe('readRunDetail', () => {
  it('returns undefined for an unknown runId', async () => {
    const cwd = await fixtureCwd('brunch-observer-missing-');
    expect(await readRunDetail(cwd, 'run-x')).toBeUndefined();
  });

  it('marks a run with torn metadata unreadable instead of throwing', async () => {
    const cwd = await fixtureCwd('brunch-observer-torn-');
    const runDir = runDirPath(cwd, 'run-t');
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), '{"truncated', 'utf8');

    expect(await readRunDetail(cwd, 'run-t')).toEqual({ runId: 'run-t', unreadable: true });
  });

  it('surfaces the current Petri ready frontier from run lifecycle facts and plan dependencies', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-ready-steps-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1' }, { id: 'frontier-2' }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', derived_from: ['REQ1'] },
          { id: 'task-2', epic_id: 'frontier-1', depends_on: ['task-1'], derived_from: ['REQ2'] },
          { id: 'task-3', epic_id: 'frontier-2', derived_from: ['REQ3'] },
        ],
      }),
      'utf8',
    );
    await writeRun(cwd, 'run-ready-frontier', {
      planPath,
      status: 'reports_initialized',
    });

    const detail = await readRunDetail(cwd, 'run-ready-frontier');

    expect(detail).toMatchObject({
      petriReadySteps: [
        { kind: 'slice_start', sliceId: 'task-1', epicId: 'frontier-1', derivedFrom: ['REQ1'] },
        { kind: 'slice_start', sliceId: 'task-3', epicId: 'frontier-2', derivedFrom: ['REQ3'] },
      ],
      petriBlockedSteps: [
        {
          kind: 'slice_start',
          sliceId: 'task-2',
          epicId: 'frontier-1',
          derivedFrom: ['REQ2'],
          blockers: [{ kind: 'dependency', sliceId: 'task-1' }],
        },
      ],
    });
  });

  it('surfaces active-slice blockers when another dependency-ready slice cannot start yet', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-active-blocker-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({ mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] }),
      'utf8',
    );
    await writeRun(cwd, 'run-active-blocker', {
      planPath,
      status: 'slice_started',
      activeSliceId: 'task-1',
    });

    const detail = await readRunDetail(cwd, 'run-active-blocker');

    expect(detail).toMatchObject({
      petriBlockedSteps: [
        {
          kind: 'slice_start',
          sliceId: 'task-2',
          blockers: [{ kind: 'active_slice', sliceId: 'task-1' }],
        },
      ],
    });
  });

  it('reports persisted epic completion as the blocker for dependent epic slices', async () => {
    const cwd = await fixtureCwd('brunch-observer-epic-blocker-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        epics: [
          { id: 'epic-1', depends_on: [] },
          { id: 'epic-2', depends_on: ['epic-1'] },
        ],
        slices: [
          { id: 'task-1', epic_id: 'epic-1' },
          { id: 'task-2', epic_id: 'epic-2' },
        ],
      }),
      'utf8',
    );
    await writeRun(cwd, 'run-epic-blocker', {
      planPath,
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });

    const detail = await readRunDetail(cwd, 'run-epic-blocker');

    expect(detail).toMatchObject({
      petriReadySteps: [{ kind: 'epic_integrate', epicId: 'epic-1' }],
      petriBlockedSteps: [
        {
          kind: 'slice_start',
          sliceId: 'task-2',
          epicId: 'epic-2',
          blockers: [{ kind: 'epic_dependency', epicId: 'epic-1' }],
        },
      ],
    });
  });

  it('recovers an epic verification claim appended before its marking write', async () => {
    const cwd = await fixtureCwd('brunch-observer-epic-claim-crash-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        epics: [
          {
            id: 'epic-1',
            depends_on: [],
            verification: [{ kind: 'criterion', target: 'npm test' }],
          },
        ],
        slices: [{ id: 'task-1', epic_id: 'epic-1' }],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-epic-claim-crash', {
      planPath,
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
      integratedEpicIds: ['epic-1'],
      epicTransitionHistory: ['epic_integrate:epic-1'],
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify({
        kind: 'epic_verification_claimed',
        ts: '2026-07-14T12:00:00.000Z',
        runId: 'run-epic-claim-crash',
        runStatus: 'slice_completed',
        epicId: 'epic-1',
        step: 'epic_verify',
      })}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-epic-claim-crash');

    expect(detail).toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        {
          kind: 'epic_verify',
          epicId: 'epic-1',
          blockers: [{ kind: 'epic_verification_authority', phase: 'claimed' }],
        },
      ],
    });
  });

  it('keeps run detail readable when duplicate slice ids make the Petri runtime invalid', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-duplicate-slice-id-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({ mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-1' }] }),
      'utf8',
    );
    await writeRun(cwd, 'run-duplicate-slices', {
      planPath,
      status: 'reports_initialized',
    });

    const detail = await readRunDetail(cwd, 'run-duplicate-slices');

    expect(detail).toMatchObject({
      runId: 'run-duplicate-slices',
      status: 'reports_initialized',
    });
    expect(detail && 'petriReadySteps' in detail ? detail.petriReadySteps : undefined).toBeUndefined();
    expect(detail && 'petriBlockedSteps' in detail ? detail.petriBlockedSteps : undefined).toBeUndefined();
  });

  it('uses the same populated plan fallback as drive when Petri runtime metadata omits it', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-runtime-plan-fallback-');
    const fallbackPlanPath = populatedPlanPath(cwd, 'run-fallback-plan');
    await mkdir(dirname(fallbackPlanPath), { recursive: true });
    await writeFile(
      fallbackPlanPath,
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }],
      }),
      'utf8',
    );
    await writeRun(cwd, 'run-fallback-plan', {
      planPath: join(cwd, 'missing-plan.json'),
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });

    const detail = await readRunDetail(cwd, 'run-fallback-plan');

    expect(detail).toMatchObject({
      petriReadySteps: [{ kind: 'slice_start', sliceId: 'task-2' }],
    });
  });

  it('returns the reports tail, skipping an in-flight partial trailing line', async () => {
    const cwd = await fixtureCwd('brunch-observer-detail-');
    const runDir = await writeRun(cwd, 'run-d', {
      status: 'slice_execution_requested',
      activeSliceId: 's1',
    });
    const events = [
      '{"event":"run_ready","runId":"run-d"}',
      '{"event":"slice_started","runId":"run-d","sliceId":"s1"}',
      '{"event":"slice_execution_requested","runId":"run-d","sliceId":"s1"}',
    ];
    await writeFile(join(runDir, 'reports.jsonl'), `${events.join('\n')}\n{"event":"slice_agent_res`, 'utf8');

    const detail = await readRunDetail(cwd, 'run-d');

    expect(detail).toMatchObject({
      runId: 'run-d',
      planPath: '/plan.json',
      reportsTotal: 3,
      sliceProgress: [{ sliceId: 's1', progress: 'started -> requested' }],
      presence: { worktree: false, reports: true, petri: false, promotion: false },
    });
    expect(detail && 'reportsTail' in detail ? detail.reportsTail.map((e) => e.event) : []).toEqual([
      'run_ready',
      'slice_started',
      'slice_execution_requested',
    ]);
  });

  it('surfaces replanning metadata in run detail', async () => {
    const cwd = await fixtureCwd('brunch-observer-replan-detail-');
    await writeRun(cwd, 'run-d', {
      status: 'abandoned',
      failedSliceIds: ['task-1'],
      supersedesRunId: 'run-old',
      abandonedAt: '2026-07-07T00:00:00.000Z',
      abandonReason: 'User chose a fresh plan',
    });

    await expect(readRunDetail(cwd, 'run-d')).resolves.toMatchObject({
      runId: 'run-d',
      status: 'abandoned',
      failedSliceIds: ['task-1'],
      supersedesRunId: 'run-old',
      abandonedAt: '2026-07-07T00:00:00.000Z',
      abandonReason: 'User chose a fresh plan',
    });
  });

  it('prefers durable terminal failed slice ids over later abandonment metadata', async () => {
    const cwd = await fixtureCwd('brunch-observer-abandoned-terminal-');
    const runDir = await writeRun(cwd, 'run-d', {
      status: 'abandoned',
      failedSliceIds: ['metadata-only'],
      abandonedAt: '2026-07-14T12:00:02.000Z',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({ initialMarking: {}, transitions: [] }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify({
        kind: 'net_halted',
        ts: '2026-07-14T12:00:01.000Z',
        runId: 'run-d',
        runStatus: 'slice_completed',
        reason: 'slice_verification_not_passed',
        failedSliceIds: ['durable-failure'],
      })}\n`,
      'utf8',
    );

    await expect(readRunDetail(cwd, 'run-d')).resolves.toMatchObject({
      status: 'abandoned',
      failedSliceIds: ['durable-failure'],
      petriProjection: {
        terminalEventKind: 'net_halted',
        failedSliceIds: ['durable-failure'],
      },
    });
  });

  it('carries the raw parsed petri net when the artifact exists and parses', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-');
    const runDir = await writeRun(cwd, 'run-p', { status: 'petri_exported' });
    const net = { places: [{ id: 'p1' }], transitions: [] };
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(join(runDir, 'petrinaut', 'net.json'), JSON.stringify(net), 'utf8');

    const detail = await readRunDetail(cwd, 'run-p');

    expect(detail).toMatchObject({
      presence: { petri: true },
      petriNet: net,
    });
  });

  it('omits the petri payload when the artifact is missing or unparseable', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-bad-');
    await writeRun(cwd, 'run-none', { status: 'run_completed' });
    const tornDir = await writeRun(cwd, 'run-torn-petri', { status: 'petri_exported' });
    await mkdir(join(tornDir, 'petrinaut'), { recursive: true });
    await writeFile(join(tornDir, 'petrinaut', 'net.json'), '{"places": [', 'utf8');

    const missing = await readRunDetail(cwd, 'run-none');
    const torn = await readRunDetail(cwd, 'run-torn-petri');

    expect(missing && 'petriNet' in missing ? missing.petriNet : 'absent').toBe('absent');
    expect(torn).toMatchObject({ presence: { petri: true } });
    expect(torn && 'petriNet' in torn ? torn.petriNet : 'absent').toBe('absent');
  });

  it('derives a Petrinaut replay export when SDCPN and an untorn journal are present', async () => {
    const cwd = await fixtureCwd('brunch-observer-petrinaut-live-');
    const runDir = await writeRun(cwd, 'run-petri-live', { status: 'worktree_created' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        initialMarking: { 'run:created': 1 },
        transitions: [
          {
            id: 'worktree_create',
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
          },
        ],
      }),
      'utf8',
    );
    await writeFile(join(runDir, 'petrinaut', 'net.sdcpn.json'), JSON.stringify(minimalSdcpnFile()), 'utf8');
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-petri-live',
        }),
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-live', {
      petrinautEnv: { PETRINAUT_URL: 'https://petrinaut.example/brunch?theme=dark' },
    });

    expect(detail).toMatchObject({
      petrinautStreamPath: '/petrinaut/stream?runId=run-petri-live',
      petrinautLaunchPath: '/petrinaut/launch?runId=run-petri-live',
      petrinautReplayExport: {
        initialState: { 'run:created': 1 },
        transitionFirings: [
          {
            transitionId: 'worktree_create',
            input: { 'run:created': 1 },
            output: { 'run:worktree_created': 1 },
          },
        ],
      },
    });
    expect(JSON.stringify(detail)).not.toContain('net.sdcpn.json');

    const invalidUrlDetail = await readRunDetail(cwd, 'run-petri-live', {
      petrinautEnv: { PETRINAUT_URL: 'file:///tmp/petrinaut.html' },
    });
    expect(invalidUrlDetail).toMatchObject({
      petrinautStreamPath: '/petrinaut/stream?runId=run-petri-live',
    });
    expect(
      invalidUrlDetail && 'petrinautLaunchPath' in invalidUrlDetail
        ? invalidUrlDetail.petrinautLaunchPath
        : 'absent',
    ).toBe('absent');
  });

  it('omits Petrinaut replay export when the SDCPN file or journal is missing or torn', async () => {
    const cwd = await fixtureCwd('brunch-observer-petrinaut-live-absent-');
    const missingJournalDir = await writeRun(cwd, 'run-missing-journal', { status: 'worktree_created' });
    const tornJournalDir = await writeRun(cwd, 'run-torn-journal', { status: 'worktree_created' });
    await mkdir(join(missingJournalDir, 'petrinaut'), { recursive: true });
    await mkdir(join(tornJournalDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(missingJournalDir, 'petrinaut', 'net.sdcpn.json'),
      JSON.stringify(minimalSdcpnFile()),
      'utf8',
    );
    await writeFile(
      join(tornJournalDir, 'petrinaut', 'net.sdcpn.json'),
      JSON.stringify(minimalSdcpnFile()),
      'utf8',
    );
    await writeFile(join(tornJournalDir, 'petrinaut', 'events.jsonl'), '{"kind":', 'utf8');

    const missingJournal = await readRunDetail(cwd, 'run-missing-journal');
    const tornJournal = await readRunDetail(cwd, 'run-torn-journal');

    expect(
      missingJournal && 'petrinautReplayExport' in missingJournal
        ? missingJournal.petrinautReplayExport
        : 'absent',
    ).toBe('absent');
    expect(
      tornJournal && 'petrinautReplayExport' in tornJournal ? tornJournal.petrinautReplayExport : 'absent',
    ).toBe('absent');
  });

  it('rejects the whole Petri event journal when a trailing line is torn', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-events-');
    const runDir = await writeRun(cwd, 'run-petri-events', { status: 'agent_result_ingested' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      [
        JSON.stringify(
          transitionEvent({
            runId: 'run-petri-events',
            runStatus: 'slice_started',
            transitionId: 'slice_start:task-1',
            subnetId: 'slice:task-1',
            step: 'slice_start',
            contract: { kind: 'structural', lane: 'slice' },
            consumed: ['run:slice_frontier'],
            produced: ['slice:task-1:started'],
            fromStatus: 'reports_initialized',
            toStatus: 'slice_started',
          }),
        ),
        JSON.stringify({
          kind: 'net_halted',
          ts: '2026-07-14T12:00:01.000Z',
          runId: 'run-petri-events',
          runStatus: 'agent_result_ingested',
          step: 'test_result',
          reason: 'test_run_failed',
          failedSliceIds: ['task-1'],
        }),
        '{"kind":"transition_fired"',
      ].join('\n'),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-events');

    expect(detail).toMatchObject({
      petriEventsTotal: 0,
      petriEventsTail: [],
      petriReadySteps: [],
      petriBlockedSteps: [
        { kind: 'authority_unreadable', blockers: [{ kind: 'parallel_authority_unreadable' }] },
      ],
    });
  });

  it('returns a derived Petri projection when both raw artifacts are present', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-projection-');
    const runDir = await writeRun(cwd, 'run-petri-projection', { status: 'promotion_prepared' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-projection',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:promotion_prepared', subnetId: 'run', name: 'Promotion prepared' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:promotion_prepared', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      [
        JSON.stringify(
          transitionEvent({
            runId: 'run-petri-projection',
            runStatus: 'promotion_prepared',
            produced: ['run:promotion_prepared'],
            toStatus: 'promotion_prepared',
          }),
        ),
        JSON.stringify({
          kind: 'net_completed',
          ts: '2026-07-14T12:00:01.000Z',
          runId: 'run-petri-projection',
          runStatus: 'promotion_prepared',
          failedSliceIds: [],
        }),
        '',
      ].join('\n'),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-projection');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 1,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
    });
  });

  it('rejects replay when the raw journal contains contradictory terminal events', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-terminal-conflict-');
    const runDir = await writeRun(cwd, 'run-petri-terminal-conflict', { status: 'promotion_prepared' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-terminal-conflict',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:promotion_prepared', subnetId: 'run', name: 'Promotion prepared' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:promotion_prepared', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      [
        JSON.stringify(
          transitionEvent({
            runId: 'run-petri-terminal-conflict',
            runStatus: 'promotion_prepared',
            produced: ['run:promotion_prepared'],
            toStatus: 'promotion_prepared',
          }),
        ),
        JSON.stringify({
          kind: 'net_completed',
          ts: '2026-07-14T12:00:01.000Z',
          runId: 'run-petri-terminal-conflict',
          runStatus: 'promotion_prepared',
          failedSliceIds: [],
        }),
        JSON.stringify({
          kind: 'net_deadlocked',
          ts: '2026-07-14T12:00:02.000Z',
          runId: 'run-petri-terminal-conflict',
          runStatus: 'promotion_prepared',
          failedSliceIds: [],
        }),
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(join(runDir, 'petrinaut', 'net.sdcpn.json'), JSON.stringify(minimalSdcpnFile()), 'utf8');

    const detail = await readRunDetail(cwd, 'run-petri-terminal-conflict');

    expect(detail).not.toHaveProperty('petriProjection');
    expect(detail).not.toHaveProperty('petrinautReplayExport');
  });

  it('omits Petrinaut replay export when SDCPN arcs reference unknown places', async () => {
    const cwd = await fixtureCwd('brunch-observer-petrinaut-invalid-sdcpn-');
    const runDir = await writeRun(cwd, 'run-petrinaut-invalid-sdcpn', { status: 'promotion_prepared' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    const sdcpn = minimalSdcpnFile();
    sdcpn.transitions[0]!.outputArcs[0]!.placeId = 'missing-place';
    await writeFile(join(runDir, 'petrinaut', 'net.sdcpn.json'), JSON.stringify(sdcpn), 'utf8');
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify({
        kind: 'transition_fired',
        runId: 'run-petrinaut-invalid-sdcpn',
        runStatus: 'worktree_created',
        transitionId: 'worktree_create',
        subnetId: 'run',
        step: 'worktree_create',
        consumed: ['run:created'],
        produced: ['missing-place'],
        fromStatus: 'created',
        toStatus: 'worktree_created',
      })}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petrinaut-invalid-sdcpn');

    expect(
      detail && 'petrinautReplayExport' in detail ? detail.petrinautReplayExport : undefined,
    ).toBeUndefined();
  });

  it('omits replay projection and Petrinaut export for a causally impossible verdict-fail then integrate journal', async () => {
    const cwd = await fixtureCwd('brunch-observer-petrinaut-impossible-verdict-');
    const runId = 'run-petrinaut-impossible-verdict';
    const runDir = await writeRun(cwd, runId, { status: 'test_result_ingested' });
    const topology = compileExecutorTopology({ slices: [{ id: 'S3' }] });
    const transitions = new Map(topology.transitions.map((transition) => [transition.id, transition]));
    const transitionIds = [
      'worktree_create',
      'populate',
      'source_policy',
      'source_copy',
      'report_init',
      'slice_start:S3',
      'slice_execute:S3',
      'agent_result:S3:attempt:1',
      'test_result_ingested:S3:attempt:1',
      'verify_failed:S3:attempt:1',
      'slice_integrate:S3',
    ];
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(join(runDir, 'petrinaut', 'net.json'), JSON.stringify(topology), 'utf8');
    await writeFile(
      join(runDir, 'petrinaut', 'net.sdcpn.json'),
      JSON.stringify(petriTopologyToSdcpnFile({ runId, topology })),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${transitionIds
        .map((transitionId, index) => {
          const transition = transitions.get(transitionId)!;
          return JSON.stringify({
            kind: 'transition_fired',
            ts: `2026-07-14T12:00:${String(index).padStart(2, '0')}.000Z`,
            runId,
            runStatus: 'test_result_ingested',
            transitionId,
            subnetId: transition.subnetId,
            step: transition.step?.kind ?? 'test_result',
            contract: transition.contract,
            consumed: transition.inputArcs.map((arc) => arc.placeId),
            produced: transition.outputArcs.map((arc) => arc.placeId),
            fromStatus: 'created',
            toStatus: 'test_result_ingested',
          });
        })
        .join('\n')}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, runId);

    expect(detail).not.toHaveProperty('petriProjection');
    expect(detail).not.toHaveProperty('petrinautReplayExport');
    expect(detail).not.toHaveProperty('petrinautStreamPath');
  });

  it('omits malformed Petri journal events instead of projecting them as terminal facts', async () => {
    const cwd = await fixtureCwd('brunch-observer-petrinaut-invalid-event-');
    const runDir = await writeRun(cwd, 'run-petrinaut-invalid-event', { status: 'promotion_prepared' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(join(runDir, 'petrinaut', 'net.sdcpn.json'), JSON.stringify(minimalSdcpnFile()), 'utf8');
    await writeFile(join(runDir, 'petrinaut', 'events.jsonl'), '{"kind":"net_completed"}\n', 'utf8');

    const detail = await readRunDetail(cwd, 'run-petrinaut-invalid-event');

    expect(detail).toMatchObject({ petriEventsTotal: 0, petriEventsTail: [] });
    expect(
      detail && 'petrinautReplayExport' in detail ? detail.petrinautReplayExport : undefined,
    ).toBeUndefined();
  });

  it('rejects replay when the raw journal fires after a terminal event', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-terminal-order-');
    const runDir = await writeRun(cwd, 'run-petri-terminal-order', { status: 'worktree_populated' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-terminal-order',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create', 'populate'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:worktree_created', subnetId: 'run', name: 'Worktree created' },
          { id: 'run:worktree_populated', subnetId: 'run', name: 'Worktree populated' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
          },
          {
            id: 'populate',
            subnetId: 'run',
            step: { kind: 'populate' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
            outputArcs: [{ placeId: 'run:worktree_populated', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      [
        JSON.stringify(
          transitionEvent({
            runId: 'run-petri-terminal-order',
          }),
        ),
        JSON.stringify({
          kind: 'net_completed',
          ts: '2026-07-14T12:00:01.000Z',
          runId: 'run-petri-terminal-order',
          runStatus: 'worktree_created',
          failedSliceIds: [],
        }),
        JSON.stringify(
          transitionEvent({
            runId: 'run-petri-terminal-order',
            runStatus: 'worktree_populated',
            transitionId: 'populate',
            step: 'populate',
            consumed: ['run:worktree_created'],
            produced: ['run:worktree_populated'],
            fromStatus: 'worktree_created',
            toStatus: 'worktree_populated',
          }),
        ),
        '',
      ].join('\n'),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-terminal-order');

    expect(detail).not.toHaveProperty('petriProjection');
    expect(detail).not.toHaveProperty('petrinautReplayExport');
  });

  it('prefers the persisted marking snapshot over replay when both are present and its derived facts still match', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-snapshot-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1', summary: 'F', depends_on: [], verification: [] }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', definition: 'task-1.', depends_on: [], verification: [] },
          { id: 'task-2', epic_id: 'frontier-1', definition: 'task-2.', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-petri-marking-snapshot', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-marking-snapshot',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:slice_frontier', subnetId: 'run', name: 'Slice frontier' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:slice_frontier', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-petri-marking-snapshot',
          runStatus: 'reports_initialized',
          produced: ['run:slice_frontier'],
          toStatus: 'reports_initialized',
        }),
      )}\n`,
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          claimedTransitionIds: ['slice_start:task-1'],
          currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
          firedTransitionCount: 5,
          lifecycleProvenance: {
            runStatus: 'reports_initialized',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-snapshot');

    expect(detail).toMatchObject({
      petriProjection: {
        claimedTransitionIds: ['slice_start:task-1'],
        currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'snapshot',
    });
  });

  it('backfills the terminal from replay when a matching marking snapshot lags the journal terminal', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-terminal-lag-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1', summary: 'F', depends_on: [], verification: [] }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', definition: 'task-1.', depends_on: [], verification: [] },
          { id: 'task-2', epic_id: 'frontier-1', definition: 'task-2.', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-petri-marking-terminal-lag', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-marking-terminal-lag',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:slice_frontier', subnetId: 'run', name: 'Slice frontier' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:slice_frontier', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      [
        JSON.stringify(
          transitionEvent({
            runId: 'run-petri-marking-terminal-lag',
            runStatus: 'reports_initialized',
            produced: ['run:slice_frontier'],
            toStatus: 'reports_initialized',
          }),
        ),
        JSON.stringify({
          kind: 'net_halted',
          ts: '2026-07-14T12:00:01.000Z',
          runId: 'run-petri-marking-terminal-lag',
          runStatus: 'reports_initialized',
          reason: 'agent_failed',
          failedSliceIds: ['task-1'],
        }),
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
          firedTransitionCount: 5,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-terminal-lag');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
        firedTransitionCount: 5,
        terminalEventKind: 'net_halted',
        haltedReason: 'agent_failed',
        terminalTs: '2026-07-14T12:00:01.000Z',
        failedSliceIds: ['task-1'],
      },
      petriProjectionSource: 'snapshot',
    });
  });

  it('strips unverifiable terminal metadata from an otherwise matching marking snapshot', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-terminal-unverifiable-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1', summary: 'F', depends_on: [], verification: [] }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', definition: 'task-1.', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-petri-marking-terminal-unverifiable', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'slice:task-1:claim': 1 },
          firedTransitionCount: 5,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
          terminalEventKind: 'net_completed',
          terminalTs: '2026-07-14T12:00:00.000Z',
          failedSliceIds: [],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-terminal-unverifiable');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'slice:task-1:claim': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'snapshot',
    });
    expect(detail).not.toMatchObject({
      petriProjection: {
        terminalEventKind: 'net_completed',
      },
    });
  });

  it('omits terminal snapshot metadata when the runtime plan cannot be reconstructed', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-terminal-checkable-');
    const runDir = await writeRun(cwd, 'run-petri-marking-terminal-checkable', {
      status: 'promotion_prepared',
      completedSliceIds: ['task-1'],
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'run:promotion_prepared': 1 },
          firedTransitionCount: 8,
          lifecycleProvenance: {
            runStatus: 'promotion_prepared',
            completedSliceIds: ['task-1'],
          },
          terminalEventKind: 'net_completed',
          terminalTs: '2026-07-14T12:00:01.000Z',
          failedSliceIds: [],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-terminal-checkable');

    expect(detail).not.toHaveProperty('petriProjection');
    expect(detail).not.toHaveProperty('petriProjectionSource');
  });

  it('treats a marking snapshot as unreadable when it pairs a non-halted terminal kind with a halted reason', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-terminal-malformed-');
    const runDir = await writeRun(cwd, 'run-petri-marking-terminal-malformed', {
      status: 'promotion_prepared',
      completedSliceIds: ['task-1'],
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-marking-terminal-malformed',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:promotion_prepared', subnetId: 'run', name: 'Promotion prepared' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:promotion_prepared', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-petri-marking-terminal-malformed',
          runStatus: 'promotion_prepared',
          produced: ['run:promotion_prepared'],
          toStatus: 'promotion_prepared',
        }),
      )}\n${JSON.stringify({ kind: 'net_completed', ts: '2026-07-14T12:00:01.000Z', runId: 'run-petri-marking-terminal-malformed', runStatus: 'promotion_prepared', failedSliceIds: [] })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'run:promotion_prepared': 1 },
          firedTransitionCount: 6,
          lifecycleProvenance: {
            runStatus: 'promotion_prepared',
            completedSliceIds: ['task-1'],
          },
          terminalEventKind: 'net_completed',
          haltedReason: 'should-not-be-here',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-terminal-malformed');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 1,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
    });
    expect(detail).not.toMatchObject({
      petriProjection: {
        haltedReason: 'should-not-be-here',
      },
    });
  });

  it('omits a provenance-matching marking snapshot when its fired transition count contradicts live run state', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-count-mismatch-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1', summary: 'F', depends_on: [], verification: [] }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', definition: 'task-1.', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-petri-marking-count-mismatch', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'run:slice_frontier': 1 },
          firedTransitionCount: 99,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-count-mismatch');

    expect(detail && 'petriProjection' in detail ? detail.petriProjection : 'absent').toBe('absent');
    expect(detail).toMatchObject({
      petriReadySteps: [{ kind: 'slice_start', sliceId: 'task-1', epicId: 'frontier-1' }],
      petriBlockedSteps: [],
    });
  });

  it('strips an impossible claimed firing set from an otherwise matching marking snapshot', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-overclaimed-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1', summary: 'F', depends_on: [], verification: [] }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', definition: 'task-1.', depends_on: [], verification: [] },
          { id: 'task-2', epic_id: 'frontier-1', definition: 'task-2.', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-petri-marking-overclaimed', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-1'],
          currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
          firedTransitionCount: 5,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-overclaimed');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'snapshot',
    });
    expect(detail).not.toMatchObject({
      petriProjection: {
        claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-1'],
      },
    });
  });

  it('omits snapshot projection when the live Petri runtime cannot be reconstructed', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-no-runtime-');
    const planPath = join(cwd, 'missing-plan.json');
    const runDir = await writeRun(cwd, 'run-petri-marking-no-runtime', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          claimedTransitionIds: ['slice_start:task-1'],
          currentMarking: { 'run:slice_frontier': 1 },
          firedTransitionCount: 5,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-no-runtime');

    expect(detail).not.toHaveProperty('petriProjection');
    expect(detail).not.toHaveProperty('petriProjectionSource');
  });

  it('omits a provenance-matching marking snapshot when its current marking contradicts the live runtime', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-runtime-mismatch-');
    const planPath = join(cwd, 'plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1', summary: 'F', depends_on: [], verification: [] }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', definition: 'task-1.', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    const runDir = await writeRun(cwd, 'run-petri-marking-runtime-mismatch', {
      planPath,
      status: 'reports_initialized',
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'run:promotion_prepared': 1 },
          firedTransitionCount: 99,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-runtime-mismatch');

    expect(detail && 'petriProjection' in detail ? detail.petriProjection : 'absent').toBe('absent');
    expect(detail).toMatchObject({
      petriReadySteps: [{ kind: 'slice_start', sliceId: 'task-1', epicId: 'frontier-1' }],
      petriBlockedSteps: [],
    });
  });

  it('falls back to replay when the persisted marking snapshot provenance no longer matches run metadata', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-marking-stale-');
    const runDir = await writeRun(cwd, 'run-petri-marking-stale', {
      status: 'promotion_prepared',
      completedSliceIds: ['task-1'],
    });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-marking-stale',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:promotion_prepared', subnetId: 'run', name: 'Promotion prepared' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:promotion_prepared', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-petri-marking-stale',
          runStatus: 'promotion_prepared',
          produced: ['run:promotion_prepared'],
          toStatus: 'promotion_prepared',
        }),
      )}\n${JSON.stringify({ kind: 'net_completed', ts: '2026-07-14T12:00:01.000Z', runId: 'run-petri-marking-stale', runStatus: 'promotion_prepared', failedSliceIds: [] })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'run:promotion_prepared': 2 },
          firedTransitionCount: 99,
          lifecycleProvenance: {
            runStatus: 'run_completed',
          },
          terminalEventKind: 'net_completed',
          terminalTs: '2026-07-14T12:00:01.000Z',
          failedSliceIds: [],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-stale');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 1,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_stale',
    });
  });

  it('omits the derived Petri projection when the raw net exists but the runtime journal is missing', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-no-journal-');
    const runDir = await writeRun(cwd, 'run-petri-no-journal', { status: 'petri_exported' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-no-journal',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [{ id: 'run:created', subnetId: 'run', name: 'Created' }],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:created', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      }),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-no-journal');

    expect(detail && 'petriProjection' in detail ? detail.petriProjection : 'absent').toBe('absent');
    expect(detail).toMatchObject({
      presence: { petri: true },
      petriEventsTotal: 0,
      petriEventsTail: [],
    });
  });

  it('rejects a final Petri journal line without a trailing newline', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-final-line-');
    const runDir = await writeRun(cwd, 'run-petri-final-line', { status: 'promotion_prepared' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'net.json'),
      JSON.stringify({
        runId: 'run-petri-final-line',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['promotion'] }],
        places: [{ id: 'run:promotion_prepared', subnetId: 'run', name: 'Promotion prepared' }],
        transitions: [],
        initialMarking: { 'run:promotion_prepared': 1 },
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      JSON.stringify({
        kind: 'net_completed',
        runId: 'run-petri-final-line',
        runStatus: 'promotion_prepared',
      }),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-final-line');

    expect(detail).toMatchObject({
      petriEventsTotal: 0,
      petriEventsTail: [],
    });
  });

  it('limits the reports tail while reporting the full total', async () => {
    const cwd = await fixtureCwd('brunch-observer-tail-limit-');
    const runDir = await writeRun(cwd, 'run-l', { status: 'run_completed' });
    const lines = [
      '{"event":"slice_started","sliceId":"task-1"}',
      '{"event":"slice_execution_requested","sliceId":"task-1"}',
      '{"event":"slice_agent_result","sliceId":"task-1"}',
      '{"event":"slice_test_result","sliceId":"task-1","status":"failed"}',
      '{"event":"slice_completed","sliceId":"task-1"}',
    ];
    await writeFile(join(runDir, 'reports.jsonl'), `${lines.join('\n')}\n`, 'utf8');

    const detail = await readRunDetail(cwd, 'run-l', { reportsTailLimit: 2 });

    expect(detail).toMatchObject({ reportsTotal: 5 });
    expect(detail && 'reportsTail' in detail ? detail.reportsTail.map((e) => e.event) : []).toEqual([
      'slice_test_result',
      'slice_completed',
    ]);
    expect(detail && 'sliceProgress' in detail ? detail.sliceProgress : []).toEqual([
      {
        sliceId: 'task-1',
        progress: 'started -> requested -> agent -> verify failed -> completed',
      },
    ]);
  });

  it('does not label non-terminal slice test results as passing verification', async () => {
    const cwd = await fixtureCwd('brunch-observer-nonterminal-verify-');
    const runDir = await writeRun(cwd, 'run-nonterminal', { status: 'test_result_ingested' });
    await writeFile(
      join(runDir, 'reports.jsonl'),
      '{"event":"slice_started","sliceId":"task-1"}\n{"event":"slice_test_result","sliceId":"task-1","status":"running"}\n',
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-nonterminal');

    expect(detail && 'sliceProgress' in detail ? detail.sliceProgress : []).toEqual([
      { sliceId: 'task-1', progress: 'started' },
    ]);
  });

  it('builds requirement statuses from the populated plan snapshot when available', async () => {
    const cwd = await fixtureCwd('brunch-observer-populated-plan-');
    const runDir = await writeRun(cwd, 'run-populated', {
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });
    const stalePlanPath = join(runDir, 'stale-plan.json');
    const populatedPlanPath = join(runDir, 'worktree', '.brunch', 'cook', 'plan.json');
    await mkdir(join(runDir, 'worktree', '.brunch', 'cook'), { recursive: true });
    await writeFile(
      stalePlanPath,
      JSON.stringify({
        spec: { requirements: [{ item_id: 'REQ_STALE', content: 'Stale requirement' }] },
        slices: [{ id: 'stale-task', derived_from: ['REQ_STALE'] }],
      }),
      'utf8',
    );
    await writeFile(
      populatedPlanPath,
      JSON.stringify({
        spec: {
          requirements: [{ item_id: 'REQ1', content: 'Populated requirement' }],
          criteria: [{ item_id: 'AC1', verifies: ['REQ1'] }],
        },
        slices: [{ id: 'task-1', derived_from: ['REQ1'] }],
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'reports.jsonl'),
      '{"event":"slice_test_result","sliceId":"task-1","status":"passed"}\n',
      'utf8',
    );
    await writeFile(
      runMetadataPath(cwd, 'run-populated'),
      `${JSON.stringify({
        runId: 'run-populated',
        specId: '42',
        planPath: stalePlanPath,
        populatedPlanPath,
        status: 'slice_completed',
        completedSliceIds: ['task-1'],
      })}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-populated');

    expect(detail && 'requirements' in detail ? detail.requirements : []).toEqual([
      {
        requirementId: 'REQ1',
        content: 'Populated requirement',
        status: 'passed',
        sliceIds: ['task-1'],
        completedSliceIds: ['task-1'],
        failedSliceIds: [],
        missingVerificationSliceIds: [],
        criterionIds: ['AC1'],
      },
    ]);
  });

  it('keeps active-slice stream tails visible while skipping corrupt stream lines', async () => {
    const cwd = await fixtureCwd('brunch-observer-stream-tail-');
    await writeRun(cwd, 'run-stream', {
      status: 'agent_result_ingested',
      activeSliceId: 'task-1',
      sliceAttemptHistory: {
        'task-1': { agent: [{ outcome: 'succeeded', attempts: 2 }] },
      },
    });
    await mkdir(join(runDirPath(cwd, 'run-stream'), 'streams', 'task-1'), { recursive: true });
    await writeFile(
      agentStreamPath(cwd, 'run-stream', 'task-1'),
      [
        JSON.stringify({ event: 'agent_stream', stream: 'stdout', text: 'first' }),
        '{bad json',
        JSON.stringify({ event: 'agent_stream', stream: 'stderr', text: 'second' }),
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      agentStreamPath(cwd, 'run-stream', 'task-1', 2),
      `${JSON.stringify({ event: 'agent_stream', stream: 'stdout', text: 'retry' })}\n`,
      'utf8',
    );
    await writeFile(
      verifyStreamPath(cwd, 'run-stream', 'task-1'),
      [JSON.stringify({ event: 'verify_stream', stream: 'stdout', text: 'verify' }), '{bad json', ''].join(
        '\n',
      ),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-stream');

    expect(detail && 'agentStreamTail' in detail ? detail.agentStreamTail : []).toEqual([
      { event: 'agent_stream', stream: 'stdout', text: 'first' },
      { event: 'agent_stream', stream: 'stderr', text: 'second' },
      { event: 'agent_stream', stream: 'stdout', text: 'retry' },
    ]);
    expect(detail && 'verifyStreamTail' in detail ? detail.verifyStreamTail : []).toEqual([
      { event: 'verify_stream', stream: 'stdout', text: 'verify' },
    ]);
  });
});
