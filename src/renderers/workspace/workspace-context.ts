import type { WorkspaceOverview } from '../../session/workspace-overview-context.js';
import type { WorkspaceCwdInventory, WorkspaceTopologyEntry } from '../../workspace/cwd-inventory.js';
import { inlineCode, joinMarkdownBlocks, markdownTable, markdownUl } from '../markdown.js';
import { section } from '../section.js';
import type { RenderTreeNode } from '../tree.js';
import { renderTreeBlock } from '../tree.js';

export function renderWorkspaceContext(context: WorkspaceCwdInventory | WorkspaceOverview): string {
  return section(
    'workspace',
    joinMarkdownBlocks(
      renderProject(context),
      renderSpecifications(context),
      renderTopology(context.topology),
    ),
  );
}

function renderProject(context: WorkspaceCwdInventory | WorkspaceOverview): string {
  return `Project:\n${markdownUl([
    `name: ${context.project.name}`,
    `slug: ${context.project.slug}`,
    `path: ${inlineCode(context.cwd)}`,
  ])}`;
}

function renderSpecifications(context: WorkspaceCwdInventory | WorkspaceOverview): string {
  const rows: Array<Array<string | number>> = [['id', 'title', 'nodes', 'sessions']];
  if ('specs' in context) {
    rows.push(...context.specs.map((spec) => [spec.id, spec.title, spec.nodeCount, spec.sessionCount]));
  }
  return `Specifications:\n${markdownTable(rows)}`;
}

function renderTopology(topology: WorkspaceTopologyEntry): string {
  return `Topology:\n${renderTreeBlock(toRenderTreeNode(topology))}`;
}

function toRenderTreeNode(entry: WorkspaceTopologyEntry): RenderTreeNode {
  const children = entry.children?.map(toRenderTreeNode);
  return {
    label: entry.kind === 'directory' ? `${entry.name} (${entry.fileCount})` : entry.name,
    ...(children ? { children } : {}),
  };
}
