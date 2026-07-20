import type { ProcessMove } from '../../../session/process-move.js';

const PROCESS_MOVE_DIRECTIVES: Record<ProcessMove, string> = {
  move_to_execution:
    'Assess whether the specification is ready to leave Specify mode; name any blocking gap, otherwise invite the user to switch to Execute mode.',
  prepare_execution:
    'Assess design, oracle, and commitment evidence; recommend one next preparation path and obtain structured user confirmation before beginning it.',
  compile_plan:
    'Assess plan-compilation readiness across design, oracle, and commitment sufficiency; name concrete gaps, then compile only when ready.',
  execute_plan:
    'Validate that the compiled plan is fresh and executable; if valid, begin only the next safe scoped unit, otherwise route to compilation or preparation.',
};

export function formatProcessMoveSeed(move: ProcessMove): string {
  return `PROCESS MOVE\n- chosen: ${move}\n- directive: ${PROCESS_MOVE_DIRECTIVES[move]}`;
}
