/**
 * Shared ASCII tree formatting substrate for Brunch LLM-facing hierarchy renders.
 *
 * Owns:
 * - pure tree-node input shape for renderers
 * - stringify-tree wrapper and fenced `tree` block convention
 * - no filesystem walking or workspace inventory semantics
 */

import { createRequire } from 'node:module';

import { markdownCodeBlock } from './markdown.js';

const require = createRequire(import.meta.url);
// `stringify-tree` publishes CommonJS only; keep the require here at the wrapper seam.
const { stringifyTree } = require('stringify-tree') as {
  stringifyTree: <T>(tn: T, nameFn: (t: T) => string, childrenFn: (t: T) => T[] | null) => string;
};

export type RenderTreeNode = {
  readonly label: string;
  readonly children?: readonly RenderTreeNode[];
};

export function renderTree(root: RenderTreeNode): string {
  return stringifyTree(
    root,
    (node) => node.label,
    (node) => [...(node.children ?? [])],
  );
}

export function renderTreeBlock(root: RenderTreeNode): string {
  return markdownCodeBlock(renderTree(root), 'tree');
}
