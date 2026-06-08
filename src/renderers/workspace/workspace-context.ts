import type { WorkspaceContextProjection } from '../../projections/workspace/workspace-context.js';

export function renderWorkspaceContext(context: WorkspaceContextProjection): string {
  if (context.mode === 'workspace_overview') {
    return renderWorkspaceOverview(context);
  }

  return renderWorkspaceCwd(context);
}

function renderWorkspaceCwd(
  context: Extract<WorkspaceContextProjection, { readonly mode: 'cwd_inventory' }>,
): string {
  const { data: inventory } = context;
  const lines = [
    '[Workspace cwd inventory]',
    `- cwd: ${inventory.cwd}`,
    `- workspace: ${inventory.hasBrunchDir ? 'existing .brunch state detected' : 'fresh workspace (no .brunch directory)'}`,
    `- session files: ${inventory.sessionFiles.length}`,
  ];

  if (inventory.sessionFiles.length > 0) {
    lines.push('- session lengths:');
    for (const session of inventory.sessionFiles) {
      lines.push(`  - ${session.file}: ${session.lineCount} lines, ${session.byteCount} bytes`);
    }
  }

  lines.push('- top-level tree:');
  for (const entry of inventory.topLevelEntries) {
    const suffix = entry.kind === 'directory' ? '/' : '';
    lines.push(`  - ${entry.name}${suffix}: ${entry.fileCount} file(s)`);
  }

  if (inventory.markdownFiles.length === 0) {
    lines.push('- markdown files: none');
  } else {
    lines.push('- markdown files:');
    for (const file of inventory.markdownFiles) {
      lines.push(`  - ${file.path}: ${file.lineCount} lines, ${file.byteCount} bytes`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderWorkspaceOverview(
  context: Extract<WorkspaceContextProjection, { readonly mode: 'workspace_overview' }>,
): string {
  const { data: overview } = context;
  const lines = [
    '[Workspace overview]',
    `- cwd: ${overview.cwd}`,
    `- specs: ${overview.specs.length}`,
    `- sessions: ${overview.sessions.length}`,
  ];

  if (overview.specs.length > 0) {
    lines.push('- spec inventory:');
    for (const spec of overview.specs) {
      lines.push(
        `  - ${spec.title} (#${spec.id}): ${spec.nodeCount} node(s), ${spec.sessionCount} session(s)`,
      );
    }
  }

  if (overview.sessions.length === 0) {
    lines.push('- session inventory: none');
  } else {
    lines.push('- session inventory:');
    for (const session of overview.sessions) {
      lines.push(
        `  - ${session.file} (${session.id}) → ${session.specTitle} (#${session.specId}), ${session.turnCount} turn(s), readiness_grade=${session.readinessGrade}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
