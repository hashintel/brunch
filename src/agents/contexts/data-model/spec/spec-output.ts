import { formatGraphNodeCode, type GraphNode } from '../../../../graph/schema/nodes.js';
import { joinMarkdownBlocks, markdownBullet, markdownHeading } from '../../../shared/markdown.js';

export interface SpecMarkdownOutputInput {
  readonly title: string;
  readonly nodes: readonly GraphNode[];
}

const SPEC_PLANE_ORDER = ['intent', 'design', 'oracle'] as const;

export function renderSpecMarkdownOutput(input: SpecMarkdownOutputInput): string {
  const nodes = input.nodes.filter((node) => node.plane !== 'plan');
  return joinMarkdownBlocks(
    markdownHeading(1, input.title),
    ...SPEC_PLANE_ORDER.map((plane) =>
      renderPlane(
        plane,
        nodes.filter((node) => node.plane === plane),
      ),
    ),
  );
}

function renderPlane(plane: (typeof SPEC_PLANE_ORDER)[number], nodes: readonly GraphNode[]): string {
  if (nodes.length === 0) return '';
  return joinMarkdownBlocks(
    markdownHeading(2, titleCase(plane)),
    nodes.slice().sort(compareNodes).map(renderNode).join('\n\n'),
  );
}

function renderNode(node: GraphNode): string {
  const code = formatGraphNodeCode(node.kind, node.kindOrdinal);
  return joinMarkdownBlocks(
    markdownHeading(3, `${code} ${node.title}`),
    node.body,
    [
      markdownBullet(`basis: ${node.basis}`),
      ...(node.source ? [markdownBullet(`source: ${node.source}`)] : []),
    ].join('\n'),
  );
}

function compareNodes(a: GraphNode, b: GraphNode): number {
  return a.kind.localeCompare(b.kind) || a.kindOrdinal - b.kindOrdinal || a.id - b.id;
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
