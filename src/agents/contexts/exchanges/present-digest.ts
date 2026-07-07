import type { PresentDigestProjection } from '../../../exchanges/projections/present-digest.js';
import type { RenderElision } from './render-honesty.js';

export function formatPresentDigest(projection: PresentDigestProjection): string {
  const lines = [`# ${projection.heading.trim()}`];
  const body = projection.body?.trim();
  if (body) lines.push('', body);

  lines.push('', '## Abstract', projection.details.digest.abstract.trim());
  const analysis = projection.details.digest.analysis?.trim();
  if (analysis) lines.push('', '## Analysis', analysis);
  const recommendation = projection.details.digest.recommendation?.trim();
  if (recommendation) lines.push('', '## Recommendation', recommendation);

  return lines.join('\n');
}

export const PRESENT_DIGEST_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'structural details schema tag' },
  { path: 'v', reason: 'structural details schema version' },
  { path: 'exchange_id', reason: 'structural exchange correlation id' },
  { path: 'tool_meta.curr', reason: 'structural tool-chain marker' },
  { path: 'tool_meta.next', reason: 'structural tool-chain marker' },
];
