import type { PresentCandidatesProjection } from '../../../exchanges/projections/present-candidates.js';
import type { RenderElision } from './render-honesty.js';

const userRubricRows = [
  ['Core bet', 'core_bet'],
  ['Best fit', 'best_fit'],
  ['Cost / complexity', 'cost_complexity'],
  ['Covers well', 'covers_well'],
  ['Main risks', 'main_risks'],
  ['Lock-in / constraints', 'lock_in_constraints'],
  ['Recommendation', 'recommendation'],
] as const;

export function formatPresentCandidates(projection: PresentCandidatesProjection): string {
  const lines = [`# ${projection.heading.trim()}`];
  const body = projection.body?.trim();
  if (body) lines.push('', body);

  projection.details.candidates.forEach((candidate, index) => {
    lines.push('', `## ${index + 1}. ${candidate.title.trim()}`);
    for (const [label, key] of userRubricRows) {
      const value = candidate.user_rubric[key]?.trim();
      if (value) lines.push('', `**${label}:** ${value}`);
    }
  });

  return lines.join('\n');
}

/**
 * Render-honesty elision list for the present_candidates content formatter:
 * model-facing content shows the user rubric as labeled lines; structural ids,
 * meta-rubric notes, and graph anchors stay machine-facing.
 */
export const PRESENT_CANDIDATES_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'structural details schema tag' },
  { path: 'v', reason: 'structural details schema version' },
  { path: 'exchange_id', reason: 'structural exchange correlation id' },
  { path: 'tool_meta.curr', reason: 'structural tool-chain marker' },
  { path: 'tool_meta.next', reason: 'structural tool-chain marker' },
  { path: 'candidates.*.id', reason: 'stable answer id; visible candidate title and order represent it' },
  { path: 'candidates.*.meta_rubric.*', reason: 'model-facing comparison hides evaluator bookkeeping' },
  {
    path: 'candidates.*.graph_refs.*.node_id',
    reason: 'graph anchor for provenance, not transcript content',
  },
];
