import { type Component } from '@earendil-works/pi-tui';
import { getBorderCharacters, table } from 'table';

import type { PresentReviewSetDetails } from '../../exchanges/schemas/index.js';
import type { NodeKind } from '../../graph/schema/nodes.js';
import type { LabTheme } from './tui-lab/index.js';

type ReviewSet = PresentReviewSetDetails['review_set'];
type ReviewNode = ReviewSet['nodes'][number];
type ReviewEndpoint = Extract<ReviewSet['edges'][number], { category: 'dependency' }>['dependency'];
type ReviewGroup = 'Intent' | 'Implementation' | 'Assurance' | 'Planning';

const REVIEW_GROUP_BY_KIND = {
  goal: 'Intent',
  thesis: 'Intent',
  story: 'Intent',
  constraint: 'Intent',
  assumption: 'Intent',
  invariant: 'Intent',
  decision: 'Intent',
  unknown: 'Intent',
  context: 'Intent',
  evidence: 'Intent',
  example: 'Intent',
  term: 'Intent',
  requirement: 'Implementation',
  interface: 'Implementation',
  module: 'Implementation',
  entity: 'Implementation',
  sketch: 'Implementation',
  criterion: 'Assurance',
  vv_method: 'Assurance',
  check: 'Assurance',
  vv_obligation: 'Assurance',
  milestone: 'Planning',
  frontier: 'Planning',
  scope: 'Planning',
} as const satisfies Record<NodeKind, ReviewGroup>;

const REVIEW_KIND_ORDER = [
  'goal',
  'thesis',
  'story',
  'constraint',
  'assumption',
  'invariant',
  'decision',
  'unknown',
  'context',
  'evidence',
  'example',
  'term',
  'requirement',
  'interface',
  'module',
  'entity',
  'sketch',
  'criterion',
  'vv_method',
  'check',
  'vv_obligation',
  'milestone',
  'frontier',
  'scope',
] as const satisfies readonly NodeKind[];

const REVIEW_KIND_RANK = new Map<NodeKind, number>(REVIEW_KIND_ORDER.map((kind, index) => [kind, index]));
const REVIEW_GROUPS: readonly ReviewGroup[] = ['Intent', 'Implementation', 'Assurance', 'Planning'];

export class ExchangeReviewSetResultComponent implements Component {
  constructor(
    private readonly details: PresentReviewSetDetails,
    private readonly theme?: LabTheme,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const nodes = this.details.review_set.nodes;
    const connectionsByNode = symbolicConnectionsByNode(this.details.review_set);
    const kindWidth = Math.max(1, ...nodes.map((node) => kindLabel(node.kind).length));
    const codeWidth = Math.max(1, ...nodes.map((node) => node.proposed_code.length));
    const terms = nodesInReviewGroup(nodes, 'Intent').filter((node) => node.kind === 'term');

    return [
      heading('Terms', this.theme),
      '',
      ...renderBorderlessLedger(width, kindWidth, codeWidth, terms, connectionsByNode, true, this.theme),
      '',
      ...REVIEW_GROUPS.flatMap((group) => {
        const groupedNodes = nodesInReviewGroup(nodes, group).filter((node) => node.kind !== 'term');
        return [
          heading(group, this.theme),
          '',
          ...renderBorderlessLedger(
            width,
            kindWidth,
            codeWidth,
            groupedNodes,
            connectionsByNode,
            false,
            this.theme,
          ),
          '',
        ];
      }),
    ];
  }
}

function renderBorderlessLedger(
  width: number,
  kindWidth: number,
  codeWidth: number,
  nodes: readonly ReviewNode[],
  connectionsByNode: ReadonlyMap<string, readonly string[]>,
  showTermDefinition: boolean,
  theme: LabTheme | undefined,
): string[] {
  if (nodes.length === 0) return [fg(theme, 'muted', 'None')];
  const contentWidth = Math.max(8, width - kindWidth - codeWidth - 6);
  let previousKind: string | undefined;
  const rows = nodes.flatMap((node) => {
    const kind = kindLabel(node.kind);
    const kindCell = kind === previousKind ? '' : fg(theme, 'muted', kind);
    previousKind = kind;
    const content = showTermDefinition ? termDefinition(node) : node.title;
    const connections = connectionsByNode.get(node.draft_id) ?? [];
    const itemRow = [kindCell, fg(theme, 'syntaxKeyword', node.proposed_code), fg(theme, 'text', content)];
    return connections.length > 0
      ? [itemRow, ['', '', fg(theme, 'muted', `refs: ${connections.join(', ')}`)]]
      : [itemRow];
  });

  return table(rows, {
    border: getBorderCharacters('void'),
    columnDefault: { paddingLeft: 0, paddingRight: 2, wrapWord: true },
    columns: [{ width: kindWidth }, { width: codeWidth }, { width: contentWidth }],
    drawHorizontalLine: () => false,
  })
    .trimEnd()
    .split('\n');
}

function symbolicConnectionsByNode(reviewSet: ReviewSet): ReadonlyMap<string, readonly string[]> {
  const nodesByDraftId = new Map(reviewSet.nodes.map((node) => [node.draft_id, node]));
  const connections = new Map<string, string[]>();
  const add = (host: ReviewEndpoint, other: ReviewEndpoint) => {
    if (!('draft_id' in host)) return;
    const otherCode =
      'existing_code' in other ? other.existing_code : nodesByDraftId.get(other.draft_id)?.proposed_code;
    if (!otherCode) return;
    connections.set(host.draft_id, [...(connections.get(host.draft_id) ?? []), otherCode]);
  };

  for (const edge of reviewSet.edges) {
    switch (edge.category) {
      case 'dependency':
        add(edge.dependency, edge.dependent);
        break;
      case 'witness':
        add(edge.claim, edge.oracle);
        break;
      case 'rationale':
        add(edge.claim, edge.support);
        break;
      case 'realization':
        add(edge.abstract, edge.concrete);
        break;
      case 'refinement':
        add(edge.abstract, edge.concrete);
        break;
      case 'exclusion':
        add(edge.boundary, edge.subject);
        break;
      case 'composition':
        add(edge.whole, edge.part);
        break;
      case 'cross_reference':
        add(edge.a, edge.b);
        break;
      case 'supersession':
        add(edge.predecessor, edge.successor);
        break;
    }
  }
  return connections;
}

function nodesInReviewGroup(nodes: readonly ReviewNode[], group: ReviewGroup): ReviewNode[] {
  return nodes
    .filter((node) => reviewGroup(node.kind) === group)
    .sort(
      (a, b) =>
        reviewKindRank(a.kind) - reviewKindRank(b.kind) || a.proposed_code.localeCompare(b.proposed_code),
    );
}

function reviewGroup(kind: string): ReviewGroup {
  if (!isNodeKind(kind)) throw new Error(`No review group mapping for node kind: ${kind}`);
  return REVIEW_GROUP_BY_KIND[kind];
}

function reviewKindRank(kind: string): number {
  if (!isNodeKind(kind)) throw new Error(`No review kind order for node kind: ${kind}`);
  return REVIEW_KIND_RANK.get(kind) ?? Number.MAX_SAFE_INTEGER;
}

function isNodeKind(kind: string): kind is NodeKind {
  return Object.hasOwn(REVIEW_GROUP_BY_KIND, kind);
}

function termDefinition(node: ReviewNode): string {
  if (
    typeof node.detail === 'object' &&
    node.detail !== null &&
    'definition' in node.detail &&
    typeof node.detail.definition === 'string'
  ) {
    return node.detail.definition;
  }
  return node.title;
}

function kindLabel(kind: string): string {
  if (kind === 'vv_method') return 'method';
  if (kind === 'vv_obligation') return 'obligation';
  return kind;
}

function heading(text: string, theme: LabTheme | undefined): string {
  return fg(theme, 'accent', theme?.bold?.(text) ?? text);
}

function fg(theme: LabTheme | undefined, color: Parameters<LabTheme['fg']>[0], text: string): string {
  return theme ? theme.fg(color, text) : text;
}
