import type { WorkspaceContextProjection } from '../../projections/workspace/workspace-context.js';

export function renderWorkspaceContext(context: WorkspaceContextProjection): string {
  const { snapshot } = context;
  const lines = [
    '[Workspace cwd snapshot]',
    `- cwd: ${snapshot.cwd}`,
    `- workspace: ${snapshot.hasBrunchDir ? 'existing .brunch state detected' : 'fresh workspace (no .brunch directory)'}`,
    `- session files: ${snapshot.sessionFiles.length}`,
  ];

  if (snapshot.sessionFiles.length > 0) {
    lines.push('- session lengths:');
    for (const session of snapshot.sessionFiles) {
      lines.push(`  - ${session.file}: ${session.lineCount} lines, ${session.byteCount} bytes`);
    }
  }

  lines.push('- top-level tree:');
  for (const entry of snapshot.topLevelEntries) {
    const suffix = entry.kind === 'directory' ? '/' : '';
    lines.push(`  - ${entry.name}${suffix}: ${entry.fileCount} file(s)`);
  }

  if (snapshot.markdownFiles.length === 0) {
    lines.push('- markdown files: none');
  } else {
    lines.push('- markdown files:');
    for (const file of snapshot.markdownFiles) {
      lines.push(`  - ${file.path}: ${file.lineCount} lines, ${file.byteCount} bytes`);
    }
  }

  return `${lines.join('\n')}\n`;
}
