import type { WorkspaceContextProjection } from '../../projections/workspace/workspace-context.js';

export function renderWorkspaceContext(context: WorkspaceContextProjection): string {
  if (context.mode === 'workspace_overview') {
    return renderWorkspaceOverview(context);
  }

  return renderWorkspaceCwd(context);
}

function renderWorkspaceCwd(
  context: Extract<WorkspaceContextProjection, { readonly mode: 'cwd_snapshot' }>,
): string {
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

function renderWorkspaceOverview(
  context: Extract<WorkspaceContextProjection, { readonly mode: 'workspace_overview' }>,
): string {
  const { snapshot } = context;
  const lines = [
    '[Workspace overview]',
    `- cwd: ${snapshot.cwd}`,
    `- specs: ${snapshot.specs.length}`,
    `- sessions: ${snapshot.sessions.length}`,
  ];

  if (snapshot.specs.length > 0) {
    lines.push('- spec inventory:');
    for (const spec of snapshot.specs) {
      lines.push(
        `  - ${spec.title} (#${spec.id}): ${spec.nodeCount} node(s), ${spec.sessionCount} session(s)`,
      );
    }
  }

  if (snapshot.sessions.length === 0) {
    lines.push('- session inventory: none');
  } else {
    lines.push('- session inventory:');
    for (const session of snapshot.sessions) {
      lines.push(
        `  - ${session.file} (${session.id}) → ${session.specTitle} (#${session.specId}), ${session.turnCount} turn(s), readiness_grade=${session.readinessGrade}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
