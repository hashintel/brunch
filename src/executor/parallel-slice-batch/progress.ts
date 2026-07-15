import type { ReadyStep } from '../orchestrate-topology.js';
import type { DriveStepProgress } from '../orchestrate.js';
import type { RunMetadata } from '../run.js';
import type { ParallelSliceBatchContext } from './types.js';

export function emitParallelStepProgress(
  ctx: ParallelSliceBatchContext,
  phase: DriveStepProgress['phase'],
  step: ReadyStep,
  state: RunMetadata,
  runStatus: RunMetadata['status'] = state.status,
): void {
  const progress: DriveStepProgress = {
    phase,
    step,
    fromStatus: state.status,
    runStatus,
    ...('epicId' in step && step.epicId ? { activeEpicId: step.epicId } : {}),
    ...('sliceId' in step ? { activeSliceId: step.sliceId } : {}),
    completedSliceIds: state.completedSliceIds ?? [],
  };
  try {
    if (phase === 'started') ctx.onStepStart?.(step.kind, state.status, progress);
    else ctx.onStepComplete?.(step.kind, runStatus, progress);
  } catch {
    // Observer failures never affect execution.
  }
}
