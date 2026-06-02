import type { WorkspaceSessionState } from './workspace-session-coordinator.js';

export interface WorkspaceSnapshot {
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
  chrome: {
    phase: 'select_spec' | 'elicitation';
    chatMode: 'select-spec' | 'responding-to-elicitation';
  };
  reason?: string;
}

export function workspaceSnapshotFromState(state: WorkspaceSessionState): WorkspaceSnapshot {
  const base = {
    status: state.status,
    cwd: state.cwd,
    spec: state.chrome.spec,
    chrome: {
      phase: state.chrome.phase,
      chatMode: state.chrome.chatMode,
    },
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

export function renderWorkspaceSnapshot(snapshot: WorkspaceSnapshot): string {
  const lines = [
    'Brunch workspace snapshot',
    `status: ${snapshot.status}`,
    `cwd: ${snapshot.cwd}`,
    `spec: ${snapshot.spec ? `${snapshot.spec.title} (${snapshot.spec.id})` : '<none>'}`,
    `phase: ${snapshot.chrome.phase}`,
    `chatMode: ${snapshot.chrome.chatMode}`,
  ];

  if (snapshot.session) {
    lines.push(`session: ${snapshot.session.id}`, `sessionFile: ${snapshot.session.file}`);
  }
  if (snapshot.reason) {
    lines.push(`reason: ${snapshot.reason}`);
  }

  return `${lines.join('\n')}\n`;
}
