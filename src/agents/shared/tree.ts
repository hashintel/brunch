/**
 * Shared ASCII tree formatting substrate for Brunch LLM-facing hierarchy renders.
 *
 * Owns:
 * - pure tree-node input shape for renderers
 * - the recursive ASCII-tree formatter and fenced `tree` block convention
 * - no filesystem walking or workspace inventory semantics
 */

import { codeBlock } from 'md-pen';

export type RenderTreeNode = {
  readonly label: string;
  readonly children?: readonly RenderTreeNode[];
};

/**
 * Prefix a child subtree's lines: the child's own line gets the branch elbow,
 * its descendants get either a vertical continuation or blank padding depending
 * on whether the child is its parent's last.
 */
function prefixChild(lines: readonly string[], last: boolean): string[] {
  return lines.map((line, index) => {
    const prefix = index === 0 ? (last ? '└─' : '├─') : last ? '  ' : '│ ';
    return prefix + line;
  });
}

function nodeToLines(node: RenderTreeNode): string[] {
  const children = node.children ?? [];
  if (children.length === 0) {
    return [`─ ${node.label}`];
  }
  return [
    `┬ ${node.label}`,
    ...children.flatMap((child, index) => prefixChild(nodeToLines(child), index === children.length - 1)),
  ];
}

export function renderTree(root: RenderTreeNode): string {
  return nodeToLines(root).join('\n');
}

export function renderTreeBlock(root: RenderTreeNode): string {
  return codeBlock(renderTree(root), 'tree');
}
