import type { WorkspacePostureState } from '../../session/workspace-session-coordinator.js';

type WorkspacePosture = Partial<WorkspacePostureState> | undefined;

/** Private formatting substrate for model-facing workspace context owners. */
export function renderWorkspacePosture(posture: WorkspacePosture): string {
  if (!posture) return 'unrecorded';
  const entries = Object.entries(posture).filter((entry): entry is [string, string] =>
    Boolean(entry[1]?.trim()),
  );
  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join('; ') : 'unrecorded';
}
