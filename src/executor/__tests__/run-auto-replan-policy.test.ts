import { describe, expect, it, vi } from 'vitest';

import { applyAutoReplanPolicy, type AutoReplanDelegates } from '../run-auto-replan-policy.js';
import type { RunReplanRecommendation } from '../run-replan-recommendation.js';

function recommendation(
  status: RunReplanRecommendation['status'],
  overrides: Partial<RunReplanRecommendation> = {},
): RunReplanRecommendation {
  return {
    runId: 'run-1',
    status,
    runStatus: status === 'missing_run' ? 'not_started' : 'created',
    diagnosis: status,
    recommendedAction: 'inspect_run',
    allowedActions: ['inspect_run'],
    eligibility: {} as RunReplanRecommendation['eligibility'],
    sideEffects: [],
    ...overrides,
  };
}

function delegates(): AutoReplanDelegates & {
  retryCurrentStep: ReturnType<typeof vi.fn<AutoReplanDelegates['retryCurrentStep']>>;
  regeneratePlan: ReturnType<typeof vi.fn<AutoReplanDelegates['regeneratePlan']>>;
} {
  return {
    retryCurrentStep: vi.fn(async () => ({
      status: 'retried_current_step',
      sideEffects: [{ kind: 'delegated_retry' }],
    })),
    regeneratePlan: vi.fn(async () => ({
      status: 'regenerated_plan',
      sideEffects: [{ kind: 'write_file' }],
    })),
  };
}

describe('applyAutoReplanPolicy', () => {
  it('executes one retry-current-step action for fresh active runs with budget', async () => {
    const ports = delegates();

    const result = await applyAutoReplanPolicy({
      recommendation: recommendation('retry_current_run', {
        recommendedAction: 'retry_current_step',
        allowedActions: ['retry_current_step', 'inspect_run', 'abandon_run'],
      }),
      retryBudgetRemaining: 1,
      delegates: ports,
    });

    expect(result).toMatchObject({
      status: 'retried_current_step',
      result: { status: 'retried_current_step' },
      sideEffects: [{ kind: 'delegated_retry' }],
    });
    expect(ports.retryCurrentStep).toHaveBeenCalledTimes(1);
    expect(ports.regeneratePlan).not.toHaveBeenCalled();
  });

  it('executes one regenerate-plan action for stale early runs', async () => {
    const ports = delegates();

    const result = await applyAutoReplanPolicy({
      recommendation: recommendation('replan_before_retry', {
        recommendedAction: 'regenerate_plan',
        allowedActions: ['regenerate_plan', 'start_new_run', 'abandon_run'],
      }),
      retryBudgetRemaining: 0,
      delegates: ports,
    });

    expect(result).toMatchObject({
      status: 'regenerated_plan',
      result: { status: 'regenerated_plan' },
      sideEffects: [{ kind: 'write_file' }],
    });
    expect(ports.regeneratePlan).toHaveBeenCalledTimes(1);
    expect(ports.retryCurrentStep).not.toHaveBeenCalled();
  });

  it('refuses stale started runs instead of auto-superseding', async () => {
    const ports = delegates();

    const result = await applyAutoReplanPolicy({
      recommendation: recommendation('start_new_run_required', {
        recommendedAction: 'start_new_run',
        allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
      }),
      retryBudgetRemaining: 1,
      delegates: ports,
    });

    expect(result).toEqual({
      status: 'needs_human_start_new_run',
      recommendation: result.recommendation,
      sideEffects: [],
    });
    expect(ports.retryCurrentStep).not.toHaveBeenCalled();
    expect(ports.regeneratePlan).not.toHaveBeenCalled();
  });

  it('does not mutate for terminal, missing, blocked, or budget-exhausted runs', async () => {
    for (const item of [
      { status: 'terminal_run' as const, expected: 'inspect_only' },
      { status: 'missing_run' as const, expected: 'needs_human_start_new_run' },
      { status: 'projection_blocked' as const, expected: 'inspect_only' },
      { status: 'retry_current_run' as const, expected: 'retry_budget_exhausted' },
    ]) {
      const ports = delegates();
      const result = await applyAutoReplanPolicy({
        recommendation: recommendation(item.status),
        retryBudgetRemaining: 0,
        delegates: ports,
      });

      expect(result.status).toBe(item.expected);
      expect(result.sideEffects).toEqual([]);
      expect(ports.retryCurrentStep).not.toHaveBeenCalled();
      expect(ports.regeneratePlan).not.toHaveBeenCalled();
    }
  });
});
