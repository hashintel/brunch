export const BRUNCH_EXECUTE_ORCHESTRATE_TOOL = 'execute_orchestrate';
export const BRUNCH_EXECUTE_AGENT_RESULT_TOOL = 'execute_agent_result';
export const BRUNCH_EXECUTE_LAUNCH_TOOL = 'execute_launch';
export const BRUNCH_EXECUTE_PLAN_FILE_TOOL = 'execute_plan_file';
export const BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL = 'execute_plan_preview';
export const BRUNCH_EXECUTE_PETRI_EXPORT_TOOL = 'execute_petri_export';
export const BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL = 'execute_promotion_prepare';
export const BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL = 'execute_land_preflight';
export const BRUNCH_EXECUTE_POPULATE_TOOL = 'execute_populate';
export const BRUNCH_EXECUTE_REPORT_INIT_TOOL = 'execute_report_init';
export const BRUNCH_EXECUTE_RUN_COMPLETE_TOOL = 'execute_run_complete';
export const BRUNCH_EXECUTE_RUN_CREATE_TOOL = 'execute_run_create';
export const BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL = 'execute_replan_recommendation';
export const BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL = 'execute_replan_start_new_run';
export const BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL = 'execute_replan_retry_current_step';
export const BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL = 'execute_replan_regenerate_plan';
export const BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL = 'execute_replan_abandon_run';
export const BRUNCH_EXECUTE_SOURCE_COPY_TOOL = 'execute_source_copy';
export const BRUNCH_EXECUTE_SOURCE_POLICY_TOOL = 'execute_source_policy';
export const BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL = 'execute_slice_complete';
export const BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL = 'execute_slice_execute';
export const BRUNCH_EXECUTE_SLICE_START_TOOL = 'execute_slice_start';
export const BRUNCH_EXECUTE_TEST_RESULT_TOOL = 'execute_test_result';
export const BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL = 'execute_worktree_create';
export const BRUNCH_EXECUTE_PLAN_CHECK_TOOL = 'execute_plan_check';
export const BRUNCH_EXECUTE_PLAN_DRAFT_TOOL = 'execute_plan_draft';
export const BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL = 'execute_plan_outline';
export const BRUNCH_EXECUTE_STATUS_TOOL = 'execute_status';
export const BRUNCH_EXECUTE_SNAPSHOT_TOOL = 'execute_snapshot';

/** The closed execute-tool roster, so consumers can key exhaustive maps by it instead of `string`. */
export type BrunchExecuteToolName =
  | typeof BRUNCH_EXECUTE_ORCHESTRATE_TOOL
  | typeof BRUNCH_EXECUTE_AGENT_RESULT_TOOL
  | typeof BRUNCH_EXECUTE_LAUNCH_TOOL
  | typeof BRUNCH_EXECUTE_PLAN_FILE_TOOL
  | typeof BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL
  | typeof BRUNCH_EXECUTE_PETRI_EXPORT_TOOL
  | typeof BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL
  | typeof BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL
  | typeof BRUNCH_EXECUTE_POPULATE_TOOL
  | typeof BRUNCH_EXECUTE_REPORT_INIT_TOOL
  | typeof BRUNCH_EXECUTE_RUN_COMPLETE_TOOL
  | typeof BRUNCH_EXECUTE_RUN_CREATE_TOOL
  | typeof BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL
  | typeof BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL
  | typeof BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL
  | typeof BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL
  | typeof BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL
  | typeof BRUNCH_EXECUTE_SOURCE_COPY_TOOL
  | typeof BRUNCH_EXECUTE_SOURCE_POLICY_TOOL
  | typeof BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL
  | typeof BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL
  | typeof BRUNCH_EXECUTE_SLICE_START_TOOL
  | typeof BRUNCH_EXECUTE_TEST_RESULT_TOOL
  | typeof BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL
  | typeof BRUNCH_EXECUTE_PLAN_CHECK_TOOL
  | typeof BRUNCH_EXECUTE_PLAN_DRAFT_TOOL
  | typeof BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL
  | typeof BRUNCH_EXECUTE_STATUS_TOOL
  | typeof BRUNCH_EXECUTE_SNAPSHOT_TOOL;
