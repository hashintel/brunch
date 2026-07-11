import { readFile } from 'node:fs/promises';

import { projectSchedulerPlan, type SchedulerPlan } from './orchestrate-topology.js';
import { petriPlanSnapshotPath } from './petri-plan-snapshot.js';
import { populatedPlanPath } from './populate.js';
import type { RunMetadata } from './run.js';

export function petriRuntimePlanPathCandidates(cwd: string, state: RunMetadata): readonly string[] {
  if (state.populatedPlanPath !== undefined) return [state.populatedPlanPath];
  const candidates = [
    state.status === 'created' || state.status === 'worktree_created'
      ? petriPlanSnapshotPath(cwd, state.runId)
      : populatedPlanPath(cwd, state.runId),
    petriPlanSnapshotPath(cwd, state.runId),
    state.planPath,
  ];
  return candidates.filter(
    (candidate, index): candidate is string =>
      typeof candidate === 'string' && candidates.indexOf(candidate) === index,
  );
}

export async function readPetriRuntimePlan(
  cwd: string,
  state: RunMetadata,
): Promise<SchedulerPlan | undefined> {
  for (const path of petriRuntimePlanPathCandidates(cwd, state)) {
    try {
      const projected = projectSchedulerPlan(JSON.parse(await readFile(path, 'utf8')));
      if (projected) return projected;
    } catch {
      // Fall through to the next candidate and fail closed to undefined.
    }
  }
  return undefined;
}
