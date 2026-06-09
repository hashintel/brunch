import { roleNamedEdgeDraftEndpoints } from '../../graph/command-executor/role-named-edge-draft.js';
import type { PresentReviewSetProjection } from '../../projections/exchanges/present-review-set.js';

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
    const { source: sourceRef, target: targetRef } = roleNamedEdgeDraftEndpoints(draft);
    const source = 'draftId' in sourceRef ? sourceRef.draftId : sourceRef.existingCode;
    const target = 'draftId' in targetRef ? targetRef.draftId : targetRef.existingCode;
    const stance = draft.category === 'proof' || draft.category === 'support' ? ` [${draft.stance}]` : '';
    lines.push('', `- ${source} —${draft.category}${stance}→ ${target}`);
    if (draft.rationale) lines.push(`  ${draft.rationale}`);
  });

  return lines.join('\n');
}
