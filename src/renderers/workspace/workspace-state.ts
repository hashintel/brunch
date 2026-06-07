import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';

export function renderWorkspaceState(state: WorkspaceState): string {
  const lines = [
    'Brunch workspace state',
    `status: ${state.status}`,
    `cwd: ${state.cwd}`,
    `spec: ${state.spec ? `${state.spec.title} (${state.spec.id})` : '<none>'}`,
    `phase: ${state.chrome.phase}`,
    `chatMode: ${state.chrome.chatMode}`,
  ];

  if (state.session) {
    lines.push(`session: ${state.session.id}`, `sessionFile: ${state.session.file}`);
  }
  if (state.reason) {
    lines.push(`reason: ${state.reason}`);
  }

  return `${lines.join('\n')}\n`;
}
