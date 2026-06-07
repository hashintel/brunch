import type { WorkspaceCwdInventory, WorkspaceOverview } from '../../session/workspace-context.js';

export type WorkspaceContextProjection =
  | {
      readonly mode: 'cwd_inventory';
      readonly data: WorkspaceCwdInventory;
    }
  | {
      readonly mode: 'workspace_overview';
      readonly data: WorkspaceOverview;
    };

export function projectWorkspaceCwdContext(data: WorkspaceCwdInventory): WorkspaceContextProjection {
  return {
    mode: 'cwd_inventory',
    data,
  };
}

export function projectWorkspaceOverviewContext(data: WorkspaceOverview): WorkspaceContextProjection {
  return {
    mode: 'workspace_overview',
    data,
  };
}
