import type { WorkspaceCwdSnapshot, WorkspaceOverviewSnapshot } from '../../session/workspace-context.js';

export type WorkspaceContextProjection =
  | {
      readonly mode: 'cwd_snapshot';
      readonly snapshot: WorkspaceCwdSnapshot;
    }
  | {
      readonly mode: 'workspace_overview';
      readonly snapshot: WorkspaceOverviewSnapshot;
    };

export function projectWorkspaceCwdContext(snapshot: WorkspaceCwdSnapshot): WorkspaceContextProjection {
  return {
    mode: 'cwd_snapshot',
    snapshot,
  };
}

export function projectWorkspaceOverviewContext(
  snapshot: WorkspaceOverviewSnapshot,
): WorkspaceContextProjection {
  return {
    mode: 'workspace_overview',
    snapshot,
  };
}
