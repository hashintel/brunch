import type { PresentReviewSetProjection } from '../../projections/structured-exchange/present-review-set.js';

export function formatPresentReviewSet(projection: PresentReviewSetProjection): string {
  const payload = projection.payload;
  const lines = [
    `## ${payload.pitch.title}`,
    '',
    payload.pitch.narrative,
    '',
    `Lens: ${payload.lens}`,
    '',
    `Epistemic status: ${payload.epistemicStatus}`,
    '',
    '### Grounding',
    '',
    payload.grounding.summary,
    '',
    ...payload.grounding.support.map((support) => `- ${support}`),
    '',
    '### Entity drafts',
  ];

  payload.entityDrafts.forEach((draft) => {
    lines.push('', `- **${draft.draftId}** (${draft.plane}/${draft.kind}): ${draft.title}`);
    if (draft.body) lines.push(`  ${draft.body}`);
  });

  lines.push('', '### Edge drafts');
  payload.edgeDrafts.forEach((draft) => {
    const source = 'draftId' in draft.source ? draft.source.draftId : draft.source.existingCode;
    const target = 'draftId' in draft.target ? draft.target.draftId : draft.target.existingCode;
    const stance = draft.stance ? ` [${draft.stance}]` : '';
    lines.push('', `- ${source} —${draft.category}${stance}→ ${target}`);
    if (draft.rationale) lines.push(`  ${draft.rationale}`);
  });

  return lines.join('\n');
}
