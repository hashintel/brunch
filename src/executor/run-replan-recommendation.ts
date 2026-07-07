import type { LaunchCurrentProjection } from './launch.js';
import {
  assessRunRetryEligibility,
  type RunRetryAction,
  type RunRetryEligibilityResult,
} from './run-retry-eligibility.js';

export interface RunReplanRecommendation {
  readonly runId: string;
  readonly status: RunRetryEligibilityResult['status'];
  readonly runStatus: RunRetryEligibilityResult['runStatus'];
  readonly diagnosis: string;
  readonly recommendedAction: RunRetryAction;
  readonly allowedActions: readonly RunRetryAction[];
  readonly eligibility: RunRetryEligibilityResult;
  readonly sideEffects: readonly [];
}

export async function recommendRunReplan(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly current: LaunchCurrentProjection;
}): Promise<RunReplanRecommendation> {
  const eligibility = await assessRunRetryEligibility(args);
  const recommendedAction = recommendedActionForEligibility(eligibility);

  return {
    runId: args.runId,
    status: eligibility.status,
    runStatus: eligibility.runStatus,
    diagnosis: diagnosisForEligibility(eligibility),
    recommendedAction,
    allowedActions: eligibility.allowedActions,
    eligibility,
    sideEffects: [],
  };
}

function recommendedActionForEligibility(eligibility: RunRetryEligibilityResult): RunRetryAction {
  switch (eligibility.status) {
    case 'missing_run':
      return 'start_new_run';
    case 'projection_blocked':
      return 'inspect_run';
    case 'retry_current_run':
      return 'retry_current_step';
    case 'replan_before_retry':
      return 'regenerate_plan';
    case 'start_new_run_required':
      return 'start_new_run';
    case 'terminal_run':
      return 'inspect_run';
  }
}

function diagnosisForEligibility(eligibility: RunRetryEligibilityResult): string {
  switch (eligibility.status) {
    case 'missing_run':
      return `Run ${eligibility.runId} does not exist. Start a new run from a fresh plan.`;
    case 'projection_blocked':
      return `Run ${eligibility.runId} cannot be retried because the current graph projection is blocked. Inspect the projection findings before replanning.`;
    case 'retry_current_run':
      return `Run ${eligibility.runId} is fresh at ${eligibility.runStatus}. Retry the current step.`;
    case 'replan_before_retry':
      return `Run ${eligibility.runId} has not produced slice execution evidence yet, but its plan is not fresh. Regenerate the plan before retrying.`;
    case 'start_new_run_required':
      return `Run ${eligibility.runId} already has execution evidence and its plan is not fresh. Start a new run from a fresh plan instead of mutating this run.`;
    case 'terminal_run':
      return `Run ${eligibility.runId} is terminal at ${eligibility.runStatus}. Inspect it rather than retrying or replanning in place.`;
  }
}
