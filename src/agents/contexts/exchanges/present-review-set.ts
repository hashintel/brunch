import { blockquote, bold, heading, italic, ul } from 'md-pen';

import type { PresentReviewSetProjection } from '../../../exchanges/projections/present-review-set.js';
import { joinMarkdownBlocks } from '../../shared/markdown.js';
import type { RenderElision } from './render-honesty.js';

export function formatExchangeStructuralIllegal(result: {
  readonly diagnostics: readonly { readonly field: string; readonly message: string }[];
}): string {
  return [
    '# STRUCTURAL_ILLEGAL',
    '',
    ...result.diagnostics.map((diagnostic) => `- ${diagnostic.field}: ${diagnostic.message}`),
  ].join('\n');
}

export function formatPresentReviewSet(projection: PresentReviewSetProjection): string {
  const reviewSet = projection.details.review_set;
  const nodesByDraftId = new Map(reviewSet.nodes.map((node) => [node.draft_id, node]));
  const nestedEdges = new Map<string, string[]>();
  const trailingEdges: string[] = [];

  for (const edge of reviewSet.edges) {
    const rendered = renderEdge(edge, nodesByDraftId);
    if (rendered.hostDraftId) {
      nestedEdges.set(rendered.hostDraftId, [
        ...(nestedEdges.get(rendered.hostDraftId) ?? []),
        rendered.line,
      ]);
    } else {
      trailingEdges.push(rendered.line);
    }
  }

  return joinMarkdownBlocks(
    heading(`Proposal: ${projection.details.display.heading}`, 2),
    projection.details.display.body ? blockquote(projection.details.display.body) : undefined,
    ul(reviewSet.nodes.flatMap((node) => renderNodeItems(node, nestedEdges.get(node.draft_id) ?? []))),
    trailingEdges.length > 0 ? joinMarkdownBlocks('Other new edges:', ul(trailingEdges)) : undefined,
  );
}

export const PRESENT_REVIEW_SET_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'structural details schema tag' },
  { path: 'v', reason: 'structural details schema version' },
  { path: 'exchange_id', reason: 'structural exchange correlation id' },
  { path: 'tool_meta.curr', reason: 'structural tool-chain marker' },
  { path: 'tool_meta.next', reason: 'structural tool-chain marker' },
  { path: 'review_set.nodes.*.draft_id', reason: 'local draft ids are represented by proposed graph codes' },
  { path: 'review_set.nodes.*.plane', reason: 'plane elided by locked neighborhood grammar' },
  { path: 'review_set.nodes.*.kind', reason: 'kind is encoded in the proposed graph-code prefix' },
  { path: 'review_set.nodes.*.detail', reason: 'detail is graph payload, not transcript content' },
  { path: 'review_set.edges.*.category', reason: 'edge category is rendered as the directional verb' },
  {
    path: 'review_set.edges.*.*.draft_id',
    reason: 'edge draft endpoints are represented by proposed graph codes',
  },
];

type ReviewSetDetails = PresentReviewSetProjection['details']['review_set'];
type ReviewSetNodeDetails = ReviewSetDetails['nodes'][number];
type ReviewSetEdgeDetails = ReviewSetDetails['edges'][number];
type ReviewSetEndpointDetails = Extract<ReviewSetEdgeDetails, { category: 'dependency' }>['dependency'];
type MarkdownListItem = string | MarkdownListItem[];

function renderNodeItems(node: ReviewSetNodeDetails, nestedEdges: readonly string[]): MarkdownListItem[] {
  const nodeText = joinMarkdownBlocks(
    bold(`$${node.proposed_code}: ${node.title.trim()}`),
    node.body?.trim(),
  );
  return nestedEdges.length > 0 ? [nodeText, [...nestedEdges]] : [nodeText];
}

function renderEdge(
  edge: ReviewSetEdgeDetails,
  nodesByDraftId: ReadonlyMap<string, ReviewSetNodeDetails>,
): { readonly hostDraftId?: string | undefined; readonly line: string } {
  switch (edge.category) {
    case 'dependency':
      return renderSubjectEdge(edge.dependent, 'depends on', edge.dependency, edge.rationale, nodesByDraftId);
    case 'witness':
      return renderSubjectEdge(
        edge.oracle,
        'witnesses',
        edge.claim,
        edge.rationale,
        nodesByDraftId,
        edge.stance,
      );
    case 'rationale':
      return renderSubjectEdge(
        edge.support,
        edge.stance === 'against' ? 'argues against' : 'supports',
        edge.claim,
        edge.rationale,
        nodesByDraftId,
      );
    case 'realization':
      return renderSubjectEdge(edge.concrete, 'realizes', edge.abstract, edge.rationale, nodesByDraftId);
    case 'refinement':
      return renderSubjectEdge(edge.concrete, 'refines', edge.abstract, edge.rationale, nodesByDraftId);
    case 'exclusion':
      return renderSubjectEdge(edge.boundary, 'excludes', edge.subject, edge.rationale, nodesByDraftId);
    case 'composition':
      return renderSubjectEdge(edge.part, 'part of', edge.whole, edge.rationale, nodesByDraftId);
    case 'cross_reference':
      return renderSubjectEdge(edge.a, 'relates to', edge.b, edge.rationale, nodesByDraftId);
    case 'supersession':
      return renderSubjectEdge(
        edge.successor,
        'supersedes',
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
  const stanceText = stance ? ` ${italic(`(${stance})`)}` : '';
  if ('draft_id' in subject) {
    return {
      hostDraftId: subject.draft_id,
      line: joinMarkdownBlocks(
        `${verb} ${bold(endpointLabel(object, nodesByDraftId))}${stanceText}`,
        rationale ? blockquote(rationale) : undefined,
      ),
    };
  }

  return {
    line: joinMarkdownBlocks(
      `${bold(endpointLabel(subject, nodesByDraftId))} ${verb} ${bold(endpointLabel(object, nodesByDraftId))}${stanceText}`,
      rationale ? blockquote(rationale) : undefined,
    ),
  };
}

function endpointLabel(
  ref: ReviewSetEndpointDetails,
  nodesByDraftId: ReadonlyMap<string, ReviewSetNodeDetails>,
): string {
  if ('existing_code' in ref) return ref.existing_code;
  const node = nodesByDraftId.get(ref.draft_id);
  return node ? `$${node.proposed_code}` : ref.draft_id;
}
