import type { WorkspaceSnapshot } from '../../projections/workspace/workspace-snapshot.js';

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
