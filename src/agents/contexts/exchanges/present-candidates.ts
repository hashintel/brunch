import type { PresentCandidatesProjection } from '../../../projections/exchanges/present-candidates.js';

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
