import type { WorkspaceSessionState } from '../../session/workspace-session-coordinator.js';

export interface WorkspaceState {
  status: WorkspaceSessionState['status'];
  cwd: string;
  spec: {
    id: number;
    title: string;
  } | null;
  session?: {
    id: string;
    file: string;
  };
  chrome: Record<string, never>;
  reason?: string;
}

export function projectWorkspaceState(state: WorkspaceSessionState): WorkspaceState {
  const base = {
    status: state.status,
    cwd: state.cwd,
    spec: state.chrome.spec,
    chrome: {},
  };

  if (state.status === 'ready') {
    return {
      ...base,
      spec: state.spec,
      session: { id: state.session.id, file: state.session.file },
    };
  }

  if (state.status === 'needs_human') {
    return { ...base, reason: state.reason };
  }

  return base;
}
