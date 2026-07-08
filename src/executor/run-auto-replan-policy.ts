import type { RunReplanRecommendation } from './run-replan-recommendation.js';

export interface AutoReplanActionResult {
  readonly status: string;
  readonly sideEffects: readonly unknown[];
}

export interface AutoReplanDelegates {
  retryCurrentStep(): Promise<AutoReplanActionResult>;
  regeneratePlan(): Promise<AutoReplanActionResult>;
}

export type AutoReplanPolicyResult =
  | {
      readonly status: 'retried_current_step';
      readonly recommendation: RunReplanRecommendation;
      readonly result: AutoReplanActionResult;
      readonly sideEffects: AutoReplanActionResult['sideEffects'];
    }
  | {
      readonly status: 'regenerated_plan';
      readonly recommendation: RunReplanRecommendation;
      readonly result: AutoReplanActionResult;
      readonly sideEffects: AutoReplanActionResult['sideEffects'];
    }
  | {
      readonly status:
        | 'retry_budget_exhausted'
        | 'needs_human_start_new_run'
        | 'inspect_only'
        | 'automation_not_allowed';
      readonly recommendation: RunReplanRecommendation;
      readonly sideEffects: readonly [];
    };

export async function applyAutoReplanPolicy(args: {
  readonly recommendation: RunReplanRecommendation;
  readonly retryBudgetRemaining: number;
  readonly delegates: AutoReplanDelegates;
}): Promise<AutoReplanPolicyResult> {
  switch (args.recommendation.status) {
    case 'retry_current_run': {
      if (args.retryBudgetRemaining <= 0) {
        return { status: 'retry_budget_exhausted', recommendation: args.recommendation, sideEffects: [] };
      }
      const result = await args.delegates.retryCurrentStep();
      return {
        status: 'retried_current_step',
        recommendation: args.recommendation,
        result,
        sideEffects: result.sideEffects,
      };
    }
    case 'replan_before_retry': {
      const result = await args.delegates.regeneratePlan();
      return {
        status: 'regenerated_plan',
        recommendation: args.recommendation,
        result,
        sideEffects: result.sideEffects,
      };
    }
    case 'start_new_run_required':
    case 'missing_run':
      return { status: 'needs_human_start_new_run', recommendation: args.recommendation, sideEffects: [] };
    case 'terminal_run':
    case 'projection_blocked':
      return { status: 'inspect_only', recommendation: args.recommendation, sideEffects: [] };
  }
}
