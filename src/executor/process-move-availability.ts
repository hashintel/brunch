import {
  projectExecuteGraph,
  deterministicCompileAdmissionFindings,
  type ProjectExecuteGraphInput,
} from './execute-projection.js';
import { prepareLaunch } from './launch.js';

export interface DeterministicProcessMoveAvailability {
  readonly move_to_execution: false;
  readonly prepare_execution: true;
  readonly compile_plan: boolean;
  readonly execute_plan: boolean;
}

/** Read-only deterministic availability for the Execute orientation menu. */
export async function resolveDeterministicProcessMoveAvailability(
  input: ProjectExecuteGraphInput & { readonly cwd: string },
): Promise<DeterministicProcessMoveAvailability> {
  const fallback: DeterministicProcessMoveAvailability = {
    move_to_execution: false,
    prepare_execution: true,
    compile_plan: false,
    execute_plan: false,
  };
  try {
    const projection = projectExecuteGraph(input);
    if (projection.check.status !== 'ok' || deterministicCompileAdmissionFindings(projection).length > 0)
      return fallback;
    const launch = await prepareLaunch({
      cwd: input.cwd,
      specId: String(input.specId),
      current: {
        specId: String(input.specId),
        mode: projection.snapshot.mode,
        source: projection.source,
        checkStatus: projection.check.status,
      },
    });
    return { ...fallback, compile_plan: true, execute_plan: launch.status === 'ready' };
  } catch {
    return fallback;
  }
}
