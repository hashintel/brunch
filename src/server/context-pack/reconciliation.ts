import type { ReconciliationContextPack, ReconciliationContextPackInput } from '../context-pack.js';
import { buildIntentAnchors, formatExistingKnowledgeAnchors } from './anchors.js';

function findAnchor(
  anchors: ReconciliationContextPack['data']['knownIntentAnchors'],
  id: number,
): ReconciliationContextPack['data']['knownIntentAnchors'][number] {
  const anchor = anchors.find((item) => item.id === id);
  if (!anchor) {
    throw new Error(`Reconciliation context pack is missing intent anchor #${id}`);
  }
  return anchor;
}

export function buildReconciliationContextPack(
  input: ReconciliationContextPackInput,
): ReconciliationContextPack {
  const knownIntentAnchors = buildIntentAnchors(input.entities);

  return {
    scenario: 'reconciliation',
    data: {
      objective: input.objective,
      knownIntentAnchors,
      openNeeds: input.openNeeds.map((need) => ({
        id: need.id,
        kind: need.kind,
        status: need.status,
        reason: need.reason ?? undefined,
        source: findAnchor(knownIntentAnchors, need.sourceItemId),
        target: findAnchor(knownIntentAnchors, need.targetItemId),
      })),
    },
  };
}

export function renderReconciliationContextPack(pack: ReconciliationContextPack): string {
  const sections = [`Reconciliation objective:\n${pack.data.objective}`];

  if (pack.data.openNeeds.length > 0) {
    sections.push(
      `Open reconciliation needs:\n${pack.data.openNeeds
        .map((need) => {
          const lines = [
            `- RN#${need.id} ${need.kind} (${need.status})`,
            `  Source: #${need.source.id} ${need.source.kind} | ${need.source.preview}`,
            `  Target: #${need.target.id} ${need.target.kind} | ${need.target.preview}`,
          ];
          if (need.reason) {
            lines.push(`  Reason: ${need.reason}`);
          }
          return lines.join('\n');
        })
        .join('\n')}`,
    );
  } else {
    sections.push('Open reconciliation needs:\nNone.');
  }

  const knownIntentAnchors = formatExistingKnowledgeAnchors(
    pack.data.knownIntentAnchors,
    'Known intent anchors',
  );
  if (knownIntentAnchors) {
    sections.push(knownIntentAnchors);
  }

  sections.push(
    `Proposal boundary:\n- Read the queue and graph context only; do not mutate durable Brunch state.\n- Propose resolution strategies for human review instead of resolving needs.\n- Preserve source/target direction and cite reconciliation need ids in any proposal.`,
  );

  return sections.join('\n\n');
}
