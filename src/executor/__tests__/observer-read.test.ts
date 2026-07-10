import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { agentStreamPath } from '../agent-result.js';
import { listRuns, readRunDetail } from '../observer-read.js';
import { runDirPath, runMetadataPath, type RunMetadata } from '../run.js';
import { verifyStreamPath } from '../test-result.js';

async function fixtureCwd(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeRun(cwd: string, runId: string, metadata: Partial<RunMetadata>): Promise<string> {
  const runDir = runDirPath(cwd, runId);
  await mkdir(runDir, { recursive: true });
  const payload = {
    runId,
    specId: '42',
    planPath: '/plan.yaml',
    status: 'created',
    ...metadata,
  };
  await writeFile(runMetadataPath(cwd, runId), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return runDir;
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
    const planPath = join(cwd, 'plan.yaml');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
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
    const planPath = join(cwd, 'plan.yaml');
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
      planPath: '/plan.yaml',
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
      supersedesRunId: 'run-old',
      abandonedAt: '2026-07-07T00:00:00.000Z',
      abandonReason: 'User chose a fresh plan',
    });

    await expect(readRunDetail(cwd, 'run-d')).resolves.toMatchObject({
      runId: 'run-d',
      status: 'abandoned',
      supersedesRunId: 'run-old',
      abandonedAt: '2026-07-07T00:00:00.000Z',
      abandonReason: 'User chose a fresh plan',
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

  it('returns a raw Petri event tail/count when the journal exists and skips torn trailing lines', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-events-');
    const runDir = await writeRun(cwd, 'run-petri-events', { status: 'agent_result_ingested' });
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDir, 'petrinaut', 'events.jsonl'),
      [
        JSON.stringify({
          kind: 'transition_fired',
          runId: 'run-petri-events',
          runStatus: 'slice_started',
          transitionId: 'slice_start:task-1',
          subnetId: 'slice:task-1',
          step: 'slice_start',
          fromStatus: 'reports_initialized',
          toStatus: 'slice_started',
        }),
        JSON.stringify({
          kind: 'net_halted',
          runId: 'run-petri-events',
          runStatus: 'agent_result_ingested',
          step: 'test_result',
          reason: 'test_run_failed',
        }),
        '{"kind":"transition_fired"',
      ].join('\n'),
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-events');

    expect(detail).toMatchObject({
      petriEventsTotal: 2,
      petriEventsTail: [
        {
          kind: 'transition_fired',
          runId: 'run-petri-events',
          transitionId: 'slice_start:task-1',
          subnetId: 'slice:task-1',
        },
        {
          kind: 'net_halted',
          runId: 'run-petri-events',
          step: 'test_result',
          reason: 'test_run_failed',
        },
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
        JSON.stringify({
          kind: 'transition_fired',
          runId: 'run-petri-projection',
          runStatus: 'promotion_prepared',
          transitionId: 'worktree_create',
          subnetId: 'run',
          step: 'worktree_create',
          fromStatus: 'created',
          toStatus: 'promotion_prepared',
        }),
        JSON.stringify({
          kind: 'net_completed',
          runId: 'run-petri-projection',
          runStatus: 'promotion_prepared',
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
      `${JSON.stringify({
        kind: 'transition_fired',
        runId: 'run-petri-marking-snapshot',
        runStatus: 'reports_initialized',
        transitionId: 'worktree_create',
        subnetId: 'run',
        step: 'worktree_create',
        fromStatus: 'created',
        toStatus: 'reports_initialized',
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDir, 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          claimedTransitionIds: ['slice_start:task-1'],
          currentMarking: { 'run:slice_frontier': 1 },
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
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
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
          currentMarking: { 'run:slice_frontier': 1 },
          firedTransitionCount: 5,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
          terminalEventKind: 'net_completed',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-terminal-unverifiable');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:slice_frontier': 1 },
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

  it('keeps terminal metadata from a matching marking snapshot when run metadata makes it checkable', async () => {
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
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-petri-marking-terminal-checkable');

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 8,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'snapshot',
    });
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
      `${JSON.stringify({
        kind: 'transition_fired',
        runId: 'run-petri-marking-terminal-malformed',
        runStatus: 'promotion_prepared',
        transitionId: 'worktree_create',
        subnetId: 'run',
        step: 'worktree_create',
        fromStatus: 'created',
        toStatus: 'promotion_prepared',
      })}\n${JSON.stringify({ kind: 'net_completed', runId: 'run-petri-marking-terminal-malformed', runStatus: 'promotion_prepared' })}\n`,
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
          claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-2'],
          currentMarking: { 'run:slice_frontier': 1 },
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
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'snapshot',
    });
    expect(detail).not.toMatchObject({
      petriProjection: {
        claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-2'],
      },
    });
  });

  it('strips snapshot claims when the live Petri runtime cannot be reconstructed', async () => {
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

    expect(detail).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'snapshot',
    });
    expect(detail).not.toMatchObject({
      petriProjection: {
        claimedTransitionIds: ['slice_start:task-1'],
      },
    });
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
      `${JSON.stringify({
        kind: 'transition_fired',
        runId: 'run-petri-marking-stale',
        runStatus: 'promotion_prepared',
        transitionId: 'worktree_create',
        subnetId: 'run',
        step: 'worktree_create',
        fromStatus: 'created',
        toStatus: 'promotion_prepared',
      })}\n${JSON.stringify({ kind: 'net_completed', runId: 'run-petri-marking-stale', runStatus: 'promotion_prepared' })}\n`,
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
    const populatedPlanPath = join(runDir, 'worktree', '.brunch', 'cook', 'plan.yaml');
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
    ]);
    expect(detail && 'verifyStreamTail' in detail ? detail.verifyStreamTail : []).toEqual([
      { event: 'verify_stream', stream: 'stdout', text: 'verify' },
    ]);
  });
});
