import type { CandidateSpecContextPack, CandidateSpecContextPackInput } from '../context-pack.js';
import { buildIntentAnchors, formatAnchorBullets, formatExistingKnowledgeAnchors } from './anchors.js';

export function buildCandidateSpecContextPack(
  input: CandidateSpecContextPackInput,
): CandidateSpecContextPack {
  const knownIntentAnchors = buildIntentAnchors(input.entities);

  return {
    scenario: 'candidate-spec',
    data: {
      objective: input.objective,
      requestedCandidateCount: input.requestedCandidateCount,
      knownIntentAnchors,
      constraints: knownIntentAnchors.filter((anchor) => anchor.kind === 'constraint'),
      assumptions: knownIntentAnchors.filter((anchor) => anchor.kind === 'assumption'),
      decisions: knownIntentAnchors.filter((anchor) => anchor.kind === 'decision'),
    },
  };
}

export function renderCandidateSpecContextPack(pack: CandidateSpecContextPack): string {
  const sections = [
    `Candidate-spec objective:\n${pack.data.objective}`,
    `Requested candidate count:\n${pack.data.requestedCandidateCount}`,
  ];

  const knownIntentAnchors = formatExistingKnowledgeAnchors(
    pack.data.knownIntentAnchors,
    'Known intent anchors',
  );
  if (knownIntentAnchors) {
    sections.push(knownIntentAnchors);
  }

  if (pack.data.constraints.length > 0) {
    sections.push(`Constraints:\n${formatAnchorBullets(pack.data.constraints)}`);
  }

  if (pack.data.assumptions.length > 0) {
    sections.push(`Assumptions:\n${formatAnchorBullets(pack.data.assumptions)}`);
  }

  if (pack.data.decisions.length > 0) {
    sections.push(`Decisions:\n${formatAnchorBullets(pack.data.decisions)}`);
  }

  sections.push(`Generation instructions:
- Generate proposal directions only; do not treat output as accepted graph truth.
- For each direction, name implications, tradeoffs, likely generated knowledge, and what it rules out.
- Prefer directions that expose unresolved assumptions or constraints for human review.`);

  return sections.join('\n\n');
}
