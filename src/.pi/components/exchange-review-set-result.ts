import { type Component } from '@earendil-works/pi-tui';

import type { PresentReviewSetDetails } from '../../exchanges/schemas/index.js';
import { renderExchangeMarkdownBodyLines } from './exchange-markdown-body.js';
import { projectRoundedBox } from './rounded-box.js';
import type { LabTheme } from './tui-lab/index.js';

const CARD_STATUS = 'Review-set proposal';

export class ExchangeReviewSetResultComponent implements Component {
  constructor(
    private readonly details: PresentReviewSetDetails,
    private readonly theme?: LabTheme,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const bodyWidth = Math.max(1, width);
    const lines = [
      ...renderMarkdownLines(this.details.display.heading, this.theme, bodyWidth),
      ...renderMarkdownLines(this.details.display.body, this.theme, bodyWidth),
    ];
    const nodesByDraftId = new Map(this.details.review_set.nodes.map((node) => [node.draft_id, node]));
    const edgesByDraftId = new Map<string, string[]>();
    const detachedEdges: string[] = [];

    for (const edge of this.details.review_set.edges) {
      const rendered = renderEdge(edge, nodesByDraftId);
      if (rendered.hostDraftId) {
        edgesByDraftId.set(rendered.hostDraftId, [
          ...(edgesByDraftId.get(rendered.hostDraftId) ?? []),
          rendered.line,
        ]);
      } else {
        detachedEdges.push(rendered.line);
      }
    }

    for (const node of this.details.review_set.nodes) {
      if (lines.length > 0) lines.push('');
      lines.push(
        ...projectRoundedBox(
          [
            `Status: ${CARD_STATUS}`,
            `Title: ${node.title}`,
            ...(node.body ? [`Body: ${node.body}`] : []),
            ...(edgesByDraftId.get(node.draft_id) ?? []),
          ].map((line) => truncatePlain(line, Math.max(1, width - 4))),
          {
            topLabel:
              this.theme?.bold?.(`${node.proposed_code} · ${node.kind}`) ??
              `${node.proposed_code} · ${node.kind}`,
            labelAlign: 'left',
          },
          width,
          (text) => (this.theme ? this.theme.fg('accent', text) : text),
        ),
      );
    }

    if (detachedEdges.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push(
        ...projectRoundedBox(
          [`Status: ${CARD_STATUS}`, ...detachedEdges].map((line) =>
            truncatePlain(line, Math.max(1, width - 4)),
          ),
          { topLabel: 'Other proposed edges', labelAlign: 'left' },
          width,
          (text) => (this.theme ? this.theme.fg('accent', text) : text),
        ),
      );
    }

    return lines;
  }
}

type ReviewSetDetails = PresentReviewSetDetails['review_set'];
type ReviewSetNodeDetails = ReviewSetDetails['nodes'][number];
type ReviewSetEdgeDetails = ReviewSetDetails['edges'][number];
type ReviewSetEndpointDetails = Extract<ReviewSetEdgeDetails, { category: 'dependency' }>['dependency'];

function renderEdge(
  edge: ReviewSetEdgeDetails,
  nodesByDraftId: ReadonlyMap<string, ReviewSetNodeDetails>,
): { readonly hostDraftId?: string | undefined; readonly line: string } {
  switch (edge.category) {
    case 'dependency':
      return renderSubjectEdge(edge.dependent, 'Depends on', edge.dependency, edge.rationale, nodesByDraftId);
    case 'witness':
      return renderSubjectEdge(
        edge.oracle,
        'Witnesses',
        edge.claim,
        edge.rationale,
        nodesByDraftId,
        edge.stance,
      );
    case 'rationale':
      return renderSubjectEdge(
        edge.support,
        edge.stance === 'against' ? 'Argues against' : 'Supports',
        edge.claim,
        edge.rationale,
        nodesByDraftId,
      );
    case 'realization':
      return renderSubjectEdge(edge.concrete, 'Realizes', edge.abstract, edge.rationale, nodesByDraftId);
    case 'refinement':
      return renderSubjectEdge(edge.concrete, 'Refines', edge.abstract, edge.rationale, nodesByDraftId);
    case 'exclusion':
      return renderSubjectEdge(edge.boundary, 'Excludes', edge.subject, edge.rationale, nodesByDraftId);
    case 'composition':
      return renderSubjectEdge(edge.part, 'Part of', edge.whole, edge.rationale, nodesByDraftId);
    case 'cross_reference':
      return renderSubjectEdge(edge.a, 'Relates to', edge.b, edge.rationale, nodesByDraftId);
    case 'supersession':
      return renderSubjectEdge(
        edge.successor,
        'Supersedes',
        edge.predecessor,
        edge.rationale,
        nodesByDraftId,
      );
    default: {
      const _exhaustive: never = edge;
      return _exhaustive;
    }
  }
}

function renderSubjectEdge(
  subject: ReviewSetEndpointDetails,
  verb: string,
  object: ReviewSetEndpointDetails,
  rationale: string | undefined,
  nodesByDraftId: ReadonlyMap<string, ReviewSetNodeDetails>,
  stance?: 'for' | 'against',
): { readonly hostDraftId?: string | undefined; readonly line: string } {
  const line = [
    `${verb}: ${endpointLabel(object, nodesByDraftId)}`,
    stance ? `(${stance})` : undefined,
    rationale,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' — ');
  if ('draft_id' in subject) return { hostDraftId: subject.draft_id, line };
  return { line: `${endpointLabel(subject, nodesByDraftId)} — ${line}` };
}

function endpointLabel(
  ref: ReviewSetEndpointDetails,
  nodesByDraftId: ReadonlyMap<string, ReviewSetNodeDetails>,
): string {
  if ('existing_code' in ref) return ref.existing_code;
  return nodesByDraftId.get(ref.draft_id)?.proposed_code ?? ref.draft_id;
}

// Length truncation is acceptable here because proposal-card body lines are plain, unstyled ASCII labels.
function truncatePlain(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 1) return '…';
  return `${text.slice(0, width - 1)}…`;
}

function renderMarkdownLines(body: string | undefined, theme: LabTheme | undefined, width: number): string[] {
  return renderExchangeMarkdownBodyLines(body, theme, width).map((line) => line.trimEnd());
}
