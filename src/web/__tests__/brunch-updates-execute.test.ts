import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { invalidateBrunchUpdate } from '../subscriptions/brunch-updates.js';

function notification(updates: unknown[], topics: string[] = []) {
  return { jsonrpc: '2.0' as const, method: 'brunch.updated', params: { topics, updates } };
}

describe('brunch.updated execute topic invalidation', () => {
  it('invalidates the exact run detail/list keys and trace indexes', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    invalidateBrunchUpdate(
      queryClient,
      notification([{ topic: 'execute.runs' }, { topic: 'execute.run', runId: 'run-1' }]),
    );

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runs'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runTraceIndex'] });
    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it('falls back to broad run-detail invalidation for a bare execute.run topic', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    invalidateBrunchUpdate(queryClient, notification([], ['execute.run', 'execute.runs']));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runs'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.runTraceIndex'] });
  });

  it('patches cached run detail with live Petri hint fields before invalidating the exact run query', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'promotion_prepared',
      presence: { worktree: true, reports: true, petri: true, promotion: true },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriProjection: {
        claimedTransitionIds: ['slice_start:old'],
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriProjection: {
            claimedTransitionIds: ['slice_start:t1'],
            currentMarking: { 'run:slice_frontier': 1 },
            firedTransitionCount: 5,
          },
          petriProjectionSource: 'replay',
          petriProjectionReplayReason: 'snapshot_stale',
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriProjection: {
        claimedTransitionIds: ['slice_start:t1'],
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_stale',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('patches cached run detail with a missing-snapshot replay hint before invalidating the exact run query', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'promotion_prepared',
      presence: { worktree: true, reports: true, petri: true, promotion: true },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriProjection: {
        claimedTransitionIds: ['slice_start:t1'],
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriProjection: {
            currentMarking: { 'run:promotion_prepared': 1 },
            firedTransitionCount: 18,
            terminalEventKind: 'net_completed',
            terminalTs: '2026-07-14T12:00:00.000Z',
            failedSliceIds: [],
          },
          petriProjectionSource: 'replay',
          petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
    });
    expect(queryClient.getQueryData(['execute.run', 'run-1'])).not.toMatchObject({
      petriProjection: { claimedTransitionIds: ['slice_start:t1'] },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('normalizes zero-count places out of a live Petri projection patch', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'promotion_prepared',
      presence: { worktree: true, reports: true, petri: true, promotion: true },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
      },
      petriProjectionSource: 'snapshot',
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriProjection: {
            currentMarking: { 'run:slice_frontier': 1, 'run:spent': 0 },
            firedTransitionCount: 5,
          },
          petriProjectionSource: 'replay',
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
      },
      petriProjectionSource: 'replay',
    });
    expect(queryClient.getQueryData(['execute.run', 'run-1'])).not.toMatchObject({
      petriProjection: {
        currentMarking: { 'run:spent': 0 },
      },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('ignores a malformed Petri projection whose marking counts are not non-negative integers', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'promotion_prepared',
      presence: { worktree: true, reports: true, petri: true, promotion: true },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriProjection: {
        claimedTransitionIds: ['slice_start:t1'],
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'snapshot',
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriProjection: {
            currentMarking: { 'run:promotion_prepared': -1 },
            firedTransitionCount: 19,
          },
          petriProjectionSource: 'replay',
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriProjection: {
        claimedTransitionIds: ['slice_start:t1'],
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'snapshot',
    });
    expect(queryClient.getQueryData(['execute.run', 'run-1'])).not.toMatchObject({
      petriProjectionReplayReason: 'snapshot_stale',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('ignores a malformed Petri projection that pairs a non-halted terminal kind with a halted reason', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'promotion_prepared',
      presence: { worktree: true, reports: true, petri: true, promotion: true },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'snapshot',
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriProjection: {
            currentMarking: { 'run:promotion_prepared': 1 },
            firedTransitionCount: 18,
            terminalEventKind: 'net_completed',
            haltedReason: 'should-not-be-here',
          },
          petriProjectionSource: 'replay',
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'snapshot',
    });
    expect(queryClient.getQueryData(['execute.run', 'run-1'])).not.toMatchObject({
      petriProjection: {
        haltedReason: 'should-not-be-here',
      },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('clears a cached replay reason when a later live snapshot hint sets replay reason to null', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'promotion_prepared',
      presence: { worktree: true, reports: true, petri: true, promotion: true },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_stale',
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriProjectionSource: 'snapshot',
          petriProjectionReplayReason: null,
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriProjectionSource: 'snapshot',
    });
    expect(queryClient.getQueryData(['execute.run', 'run-1'])).not.toMatchObject({
      petriProjectionReplayReason: 'snapshot_stale',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('patches cached run detail with live Petri frontier hints before invalidating the exact run query', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      specId: '1',
      status: 'reports_initialized',
      presence: { worktree: true, reports: true, petri: true, promotion: false },
      planPath: '/plan.yaml',
      reportsTail: [],
      reportsTotal: 0,
      petriEventsTail: [],
      petriEventsTotal: 0,
      petriReadySteps: [{ kind: 'slice_start', sliceId: 'old' }],
      petriBlockedSteps: [],
      agentStreamTail: [],
      agentStreamTotal: 0,
      verifyStreamTail: [],
      verifyStreamTotal: 0,
      sliceProgress: [],
      requirements: [],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriReadySteps: [{ kind: 'slice_execute', sliceId: 'task-1', derivedFrom: ['REQ1'] }],
          petriBlockedSteps: [
            {
              kind: 'slice_start',
              sliceId: 'task-2',
              blockers: [{ kind: 'active_slice', sliceId: 'task-1' }],
            },
          ],
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).toMatchObject({
      petriReadySteps: [{ kind: 'slice_execute', sliceId: 'task-1', derivedFrom: ['REQ1'] }],
      petriBlockedSteps: [
        { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'active_slice', sliceId: 'task-1' }] },
      ],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['execute.run', 'run-1'], exact: true });
  });

  it('clears cached Petri frontier hints when runtime reconstruction becomes unreadable', () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(['execute.run', 'run-1'], {
      runId: 'run-1',
      petriReadySteps: [{ kind: 'slice_start', sliceId: 'task-1' }],
      petriBlockedSteps: [{ kind: 'slice_start', sliceId: 'task-2', blockers: [] }],
    });

    invalidateBrunchUpdate(
      queryClient,
      notification([
        {
          topic: 'execute.run',
          runId: 'run-1',
          petriReadySteps: null,
          petriBlockedSteps: null,
        },
      ]),
    );

    expect(queryClient.getQueryData(['execute.run', 'run-1'])).not.toMatchObject({
      petriReadySteps: expect.anything(),
      petriBlockedSteps: expect.anything(),
    });
  });
});
