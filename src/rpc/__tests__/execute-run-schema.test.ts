import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import type { AgentStreamEvent, VerifyStreamEvent } from '../../executor/isolated-slice-operations.js';
import type { RunSliceStreamInventory } from '../../executor/observer-read.js';
import type { BlockedStep, BlockedStepReason, ReadyStep } from '../../executor/orchestrate-topology.js';
import type { ParallelSliceSettlement } from '../../executor/petri-marking.js';
import { ExecuteRunResultSchema } from '../methods/execute.js';

const readySteps = {
  worktree_create: { kind: 'worktree_create' },
  populate: { kind: 'populate' },
  source_policy: { kind: 'source_policy' },
  source_copy: { kind: 'source_copy' },
  report_init: { kind: 'report_init' },
  slice_start: { kind: 'slice_start', sliceId: 'task-1', epicId: 'epic-1', derivedFrom: ['REQ1'] },
  slice_execute: { kind: 'slice_execute', sliceId: 'task-1', epicId: 'epic-1', derivedFrom: ['REQ1'] },
  agent_result: { kind: 'agent_result', sliceId: 'task-1', epicId: 'epic-1', derivedFrom: ['REQ1'] },
  test_result: { kind: 'test_result', sliceId: 'task-1', epicId: 'epic-1', derivedFrom: ['REQ1'] },
  slice_integrate: { kind: 'slice_integrate', sliceId: 'task-1', epicId: 'epic-1', derivedFrom: ['REQ1'] },
  slice_complete: { kind: 'slice_complete', sliceId: 'task-1', epicId: 'epic-1', derivedFrom: ['REQ1'] },
  epic_integrate: { kind: 'epic_integrate', epicId: 'epic-1' },
  epic_verify: { kind: 'epic_verify', epicId: 'epic-1' },
  epic_complete: { kind: 'epic_complete', epicId: 'epic-1' },
  run_complete: { kind: 'run_complete' },
  petri_export: { kind: 'petri_export' },
  promotion: { kind: 'promotion' },
} as const satisfies Record<ReadyStep['kind'], ReadyStep>;

const blockedReasons = {
  dependency: { kind: 'dependency', sliceId: 'task-0' },
  epic_dependency: { kind: 'epic_dependency', epicId: 'epic-0' },
  parallel_authority: { kind: 'parallel_authority', state: 'running' },
  epic_verification_authority: { kind: 'epic_verification_authority', phase: 'claimed' },
  parallel_authority_unreadable: { kind: 'parallel_authority_unreadable' },
  active_slice: { kind: 'active_slice', sliceId: 'task-0' },
} as const satisfies Record<BlockedStepReason['kind'], BlockedStepReason>;

const base = {
  runId: 'run-1',
  specId: '42',
  status: 'reports_initialized',
  presence: { worktree: true, reports: true, petri: true, promotion: false },
  planPath: '/tmp/plan.yaml',
  reportsTail: [],
  reportsTotal: 0,
  petriEventsTail: [],
  petriEventsTotal: 0,
  agentStreamTail: [],
  agentStreamTotal: 0,
  verifyStreamTail: [],
  verifyStreamTotal: 0,
  sliceStreamInventory: [],
  sliceProgress: [],
  requirements: [],
};

describe('ExecuteRunResultSchema union witnesses', () => {
  it.each(Object.values(readySteps))('accepts ready step $kind', (step) => {
    expect(Value.Check(ExecuteRunResultSchema, { ...base, petriReadySteps: [step] })).toBe(true);
  });

  it.each(Object.values(blockedReasons))('accepts blocked reason $kind', (reason) => {
    const step: BlockedStep = { kind: 'slice_start', sliceId: 'task-1', blockers: [reason] };
    expect(Value.Check(ExecuteRunResultSchema, { ...base, petriBlockedSteps: [step] })).toBe(true);
  });

  it.each([
    { kind: 'slice_start', sliceId: 'task-1', blockers: [blockedReasons.dependency] },
    { kind: 'epic_verify', epicId: 'epic-1', blockers: [blockedReasons.epic_verification_authority] },
    { kind: 'authority_unreadable', blockers: [blockedReasons.parallel_authority_unreadable] },
  ] satisfies readonly BlockedStep[])('accepts blocked step $kind', (step) => {
    expect(Value.Check(ExecuteRunResultSchema, { ...base, petriBlockedSteps: [step] })).toBe(true);
  });

  it.each([
    { sliceId: 'task-1', status: 'succeeded' },
    { sliceId: 'task-1', status: 'failed', step: 'agent_result', reason: 'agent_run_failed' },
  ] satisfies readonly ParallelSliceSettlement[])('accepts parallel settlement $status', (settlement) => {
    expect(
      Value.Check(ExecuteRunResultSchema, {
        ...base,
        petriParallelSliceBatch: { claimedSliceIds: ['task-1'], settlements: [settlement] },
      }),
    ).toBe(true);
  });

  it.each([
    { event: 'agent_stream', runId: 'run-1', sliceId: 'task-1', sequence: 0, kind: 'status', message: 'a' },
    {
      event: 'agent_stream',
      runId: 'run-1',
      epicId: 'epic-1',
      sliceId: 'task-1',
      sequence: 0,
      runSequence: 1,
      kind: 'tool',
      message: 'b',
    },
  ] satisfies readonly AgentStreamEvent[])('accepts agent stream optional framing', (event) => {
    expect(Value.Check(ExecuteRunResultSchema, { ...base, agentStreamTail: [event] })).toBe(true);
  });

  it.each([
    { event: 'verify_stream', runId: 'run-1', sliceId: 'task-1', sequence: 0, kind: 'stdout', message: 'a' },
    {
      event: 'verify_stream',
      runId: 'run-1',
      epicId: 'epic-1',
      sliceId: 'task-1',
      sequence: 0,
      runSequence: 1,
      kind: 'stderr',
      message: 'b',
    },
  ] satisfies readonly VerifyStreamEvent[])('accepts verify stream optional framing', (event) => {
    expect(Value.Check(ExecuteRunResultSchema, { ...base, verifyStreamTail: [event] })).toBe(true);
  });

  it.each([
    'claimed',
    'running',
    'succeeded_unintegrated',
    'failed',
    'integrated',
  ] satisfies readonly RunSliceStreamInventory['state'][])('accepts inventory state %s', (state) => {
    const inventory: RunSliceStreamInventory = {
      sliceId: 'task-1',
      state,
      agentAttempts: [1],
      verifyAttempts: [1],
    };
    expect(Value.Check(ExecuteRunResultSchema, { ...base, sliceStreamInventory: [inventory] })).toBe(true);
  });

  it('accepts authority-unreadable global and claimed-slice arms together', () => {
    expect(
      Value.Check(ExecuteRunResultSchema, {
        ...base,
        petriReadySteps: [],
        petriBlockedSteps: [
          { kind: 'authority_unreadable', blockers: [blockedReasons.parallel_authority_unreadable] },
          {
            kind: 'slice_start',
            sliceId: 'task-1',
            blockers: [blockedReasons.parallel_authority_unreadable],
          },
        ],
      }),
    ).toBe(true);
  });

  const replayExport = {
    definition: {
      version: 1,
      meta: { generator: 'brunch' },
      title: 'Run',
      places: [{ id: 'p1', name: 'Place', x: 0, y: 0 }],
      transitions: [
        {
          id: 't1',
          name: 'Transition',
          x: 1,
          y: 1,
          inputArcs: [{ placeId: 'p1', weight: 1, type: 'standard' }],
          outputArcs: [{ placeId: 'p1', weight: 1 }],
        },
      ],
    },
    initialState: { p1: 1 },
    transitionFirings: [
      { transitionId: 't1', input: { p1: 1 }, output: { p1: 1 }, ts: '2026-07-14T12:00:00.000Z' },
    ],
  };

  it('accepts the strict execute.run Petrinaut replay shape', () => {
    expect(Value.Check(ExecuteRunResultSchema, { ...base, petrinautReplayExport: replayExport })).toBe(true);
  });

  it.each([
    '2026-02-30T12:00:00.000Z',
    '2026-13-14T12:00:00.000Z',
    '2026-07-14T25:00:00.000Z',
    '2026-07-14T12:00:00Z',
    '2026-07-14T12:00:00.000+01:00',
  ])('rejects impossible Petrinaut firing date-time %s', (ts) => {
    const candidate = structuredClone(replayExport);
    candidate.transitionFirings[0]!.ts = ts;
    expect(Value.Check(ExecuteRunResultSchema, { ...base, petrinautReplayExport: candidate })).toBe(false);
  });

  it.each([
    [
      'missing place x',
      (value: typeof replayExport) => delete (value.definition.places[0] as { x?: number }).x,
    ],
    [
      'missing transition y',
      (value: typeof replayExport) => delete (value.definition.transitions[0] as { y?: number }).y,
    ],
    [
      'non-finite coordinate',
      (value: typeof replayExport) => (value.definition.places[0]!.x = Number.POSITIVE_INFINITY),
    ],
    [
      'zero input weight',
      (value: typeof replayExport) => (value.definition.transitions[0]!.inputArcs[0]!.weight = 0),
    ],
    [
      'fractional output weight',
      (value: typeof replayExport) => (value.definition.transitions[0]!.outputArcs[0]!.weight = 1.5),
    ],
    [
      'malformed firing timestamp',
      (value: typeof replayExport) => (value.transitionFirings[0]!.ts = '2026-07-14 12:00:00Z'),
    ],
  ])('rejects Petrinaut replay with %s', (_label, mutate) => {
    const candidate = structuredClone(replayExport);
    mutate(candidate);
    expect(Value.Check(ExecuteRunResultSchema, { ...base, petrinautReplayExport: candidate })).toBe(false);
  });
});
