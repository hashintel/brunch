import { roleNamedEdgeDraftEndpoints } from '../../../graph/command-executor/role-named-edge-draft.js';
import { edgeLabel } from '../../../graph/projection/labels.js';
import type { ReviewSetProposalPayload } from '../../../graph/review-set.js';
import { NODE_KINDS } from '../../../graph/schema/kinds.js';
import type { NodeKind } from '../../../graph/schema/nodes.js';
import type { PresentReviewSetProjection } from '../../../projections/exchanges/present-review-set.js';

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
  const payload = projection.payload;
  const lines = [
    `# ${payload.pitch.title}`,
    '',
    payload.pitch.narrative,
    '',
    `Lens: ${payload.lens}`,
    '',
    `Epistemic status: ${payload.epistemicStatus}`,
    '',
    '## Grounding',
    '',
    payload.grounding.summary,
    '',
    ...payload.grounding.support.map((support) => `- ${support}`),
    '',
    '## Entity drafts',
  ];

  payload.entityDrafts.forEach((draft) => {
    lines.push('', `- **${draft.draftId}** (${draft.plane}/${draft.kind}): ${draft.title}`);
    if (draft.body) lines.push(`  ${draft.body}`);
  });

  lines.push('', '## Edge drafts');
  const draftKinds = draftKindMap(payload.entityDrafts);
  payload.edgeDrafts.forEach((draft) => {
    const { source: sourceRef, target: targetRef } = roleNamedEdgeDraftEndpoints(draft);
    const source = endpointLabel(sourceRef);
    const target = endpointLabel(targetRef);
    const sourceKind = 'draftId' in sourceRef ? draftKinds.get(sourceRef.draftId) : undefined;
    const targetKind = 'draftId' in targetRef ? draftKinds.get(targetRef.draftId) : undefined;
    const relation = edgeLabel({
      category: draft.category,
      anchorRole: 'source',
      stance: 'stance' in draft ? draft.stance : undefined,
      sourceKind,
      targetKind,
    });
    lines.push('', `- ${source} ${relation} ${target}`);
    if (draft.rationale) lines.push(`  ${draft.rationale}`);
  });

  return lines.join('\n');
}

function draftKindMap(drafts: ReviewSetProposalPayload['entityDrafts']): ReadonlyMap<string, NodeKind> {
  const entries = drafts.flatMap((draft) =>
    isNodeKind(draft.kind) ? [[draft.draftId, draft.kind] as const] : [],
  );
  return new Map(entries);
}

function endpointLabel(ref: { readonly draftId: string } | { readonly existingCode: string }): string {
  return 'draftId' in ref ? ref.draftId : ref.existingCode;
}

function isNodeKind(value: string): value is NodeKind {
  return NODE_KINDS.includes(value as NodeKind);
}
