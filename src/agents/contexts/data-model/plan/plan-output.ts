import { formatGraphNodeCode, type GraphNode } from '../../../../graph/schema/nodes.js';
import { joinMarkdownBlocks, markdownBullet, markdownHeading } from '../../../shared/markdown.js';

export interface PlanMarkdownOutputInput {
  readonly title: string;
  readonly nodes: readonly GraphNode[];
}

const PLAN_KIND_ORDER = ['milestone', 'frontier'] as const;

export function renderPlanMarkdownOutput(input: PlanMarkdownOutputInput): string {
  const planNodes = input.nodes.filter((node) => node.plane === 'plan');
  return joinMarkdownBlocks(
    markdownHeading(1, input.title),
    ...PLAN_KIND_ORDER.map((kind) =>
      renderKind(
        kind,
        planNodes.filter((node) => node.kind === kind),
      ),
    ),
  );
}

function renderKind(kind: (typeof PLAN_KIND_ORDER)[number], nodes: readonly GraphNode[]): string {
  if (nodes.length === 0) return '';
  return joinMarkdownBlocks(
    markdownHeading(2, titleCase(kind)),
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
  return a.kindOrdinal - b.kindOrdinal || a.id - b.id;
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
