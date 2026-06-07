import type { WorkspaceCwdSnapshot } from '../../session/workspace-context.js';

export interface WorkspaceContextProjection {
  readonly mode: 'cwd_snapshot';
  readonly snapshot: WorkspaceCwdSnapshot;
}

export function projectWorkspaceCwdContext(snapshot: WorkspaceCwdSnapshot): WorkspaceContextProjection {
  return {
    mode: 'cwd_snapshot',
    snapshot,
  };
}
