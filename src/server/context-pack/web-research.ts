import type { WebResearchContextPack, WebResearchContextPackInput } from '../context-pack.js';
import { buildIntentAnchors, formatExistingKnowledgeAnchors } from './anchors.js';

export function buildWebResearchContextPack(input: WebResearchContextPackInput): WebResearchContextPack {
  return {
    scenario: 'web-research',
    data: {
      researchObjective: input.researchObjective,
      triggeringQuestion: input.triggeringQuestion,
      knownIntentAnchors: buildIntentAnchors(input.entities),
      constraints: input.constraints ?? [],
    },
  };
}

export function renderWebResearchContextPack(pack: WebResearchContextPack): string {
  const sections = [`Research objective:\n${pack.data.researchObjective}`];

  if (pack.data.triggeringQuestion) {
    sections.push(`Triggering question:\n${pack.data.triggeringQuestion}`);
  }

  const knownIntentAnchors = formatExistingKnowledgeAnchors(
    pack.data.knownIntentAnchors,
    'Known intent anchors',
  );
  if (knownIntentAnchors) {
    sections.push(knownIntentAnchors);
  }

  if (pack.data.constraints.length > 0) {
    sections.push(
      `Research constraints:\n${pack.data.constraints.map((constraint) => `- ${constraint}`).join('\n')}`,
    );
  }

  return sections.join('\n\n');
}
