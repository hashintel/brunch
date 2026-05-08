import {
  knowledgeKindRegistry,
  knowledgeKinds,
  knowledgeKindSemanticRoles,
  observerPhaseOntologyPolicies,
  type KnowledgeKind,
} from '@/shared/knowledge.js';

import type { Turn } from './db.js';
import { renderPromptAsset } from './prompt-loader.js';

function formatKindList(kinds: readonly KnowledgeKind[]): string {
  const labels = kinds.map((kind) => `**${kind}**`);

  return labels.length < 3 ? labels.join(' and ') : `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

function buildObserverPhaseBias(phase: Turn['phase']): string {
  const policy = observerPhaseOntologyPolicies[phase];
  const allowedKinds = policy.allowedKinds as readonly KnowledgeKind[];
  const correctionKindList = policy.correctionKinds as readonly KnowledgeKind[];
  const deferredKindList =
    'deferredKinds' in policy ? (policy.deferredKinds as readonly KnowledgeKind[]) : [];
  const focusKinds = new Set<KnowledgeKind>(policy.focusKinds as readonly KnowledgeKind[]);
  const correctionKinds = new Set<KnowledgeKind>(correctionKindList);
  const deferredKinds = new Set<KnowledgeKind>(deferredKindList);
  const supportingKinds = allowedKinds.filter((kind) => !focusKinds.has(kind) && !correctionKinds.has(kind));
  const disallowedKinds = knowledgeKinds.filter(
    (kind) => !allowedKinds.includes(kind) && !deferredKinds.has(kind),
  );

  const lines = [`For ${phase}-mode turns, prioritize ${formatKindList(policy.focusKinds)} items.`];

  if (correctionKindList.length > 0) {
    lines.push(
      `Still allow ${formatKindList(correctionKindList)} corrections when the turn clearly revises grounding understanding.`,
    );
  }

  if (supportingKinds.length > 0) {
    lines.push(
      `Leave ${formatKindList(supportingKinds)} empty unless the turn makes them genuinely explicit.`,
    );
  }

  if (deferredKindList.length > 0) {
    lines.push(
      `In this phase, defer ${formatKindList(deferredKindList)} extraction until a later phase that focuses on those items unless the turn truly cannot be represented without it.`,
    );
  }

  if (disallowedKinds.length > 0) {
    lines.push(`Leave ${formatKindList(disallowedKinds)} empty in this phase.`);
  }

  if (phase === 'requirements' || phase === 'criteria') {
    lines.push(
      `Distinguish criteria from requirements: a **requirement** is ${knowledgeKindSemanticRoles.requirement}, while a **criterion** is ${knowledgeKindSemanticRoles.criterion}.`,
    );
  }

  if (phase === 'grounding') {
    lines.push(
      'When the user selects options, treat those selections as resonance signals — indicators of their direction or thinking — and capture them as context, goals, or constraints rather than as decisive commitments.',
    );
  } else if (phase === 'design') {
    lines.push(
      'When the user selects options, treat those selections as commitment signals and capture them as decisions or assumptions.',
    );
  }

  return lines.join(' ');
}

export function buildObserverSystemPrompt(phase: Turn['phase']): string {
  const phaseBias = buildObserverPhaseBias(phase);
  const kindSemantics = knowledgeKindRegistry
    .map((entry, index) => `${index + 1}. **${entry.kind}** — ${knowledgeKindSemanticRoles[entry.kind]}.`)
    .join('\n');
  const schemaShape = JSON.stringify({
    ...Object.fromEntries(knowledgeKindRegistry.map((entry) => [entry.collectionKey, ['...']])),
    relationships: [
      {
        relation: 'derived_from',
        source: { source: 'current_turn', kind: 'context', index: 0 },
        target: { source: 'existing', id: 1 },
      },
    ],
  });

  return renderPromptAsset('observer.system', {
    kindSemantics,
    phaseBias,
    schemaShape,
  });
}
