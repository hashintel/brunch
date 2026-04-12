import { bold, h1, h2, h3, ul } from 'md-pen';

import type { EntitiesData } from '../shared/api-types.js';
import { knowledgeKindRegistry } from '../shared/knowledge.js';
import type { WorkflowState } from './db.js';

function renderItem(item: { content: string; rationale?: string | null }): string {
  const parts = [item.content];
  if (item.rationale) {
    parts.push(`— ${item.rationale}`);
  }
  return parts.join(' ');
}

function getReviewedExportItems(
  items: Array<{ content: string; rationale?: string | null; reviewStatus?: string }>,
) {
  return items.filter((item) => !('reviewStatus' in item) || item.reviewStatus === 'approved');
}

function renderCaveats(workflow: WorkflowState): string {
  const caveats: string[] = [];
  for (const [phase, state] of Object.entries(workflow.phases)) {
    if (state.closureBasis && state.closureBasis !== 'interviewer_recommended') {
      caveats.push(`${bold(phase)} was closed via user-forced closure`);
    }
    if (state.readiness === 'low') {
      caveats.push(`${bold(phase)} was closed with low readiness`);
    }
  }
  if (caveats.length === 0) return '';
  return `${h3('Closure Caveats')}\n\n${ul(caveats)}\n`;
}

export function renderExportMarkdown(
  projectName: string,
  entities: EntitiesData,
  workflow: WorkflowState,
): string {
  const sections: string[] = [h1(projectName), ''];

  const caveatSection = renderCaveats(workflow);
  if (caveatSection) {
    sections.push(caveatSection);
  }

  for (const entry of knowledgeKindRegistry) {
    const items = getReviewedExportItems(entities[entry.collectionKey]);
    if (items.length === 0) continue;

    sections.push(h2(entry.label));
    sections.push('');
    sections.push(ul(items.map(renderItem)));
    sections.push('');
  }

  return sections.join('\n');
}

export function isExportReady(workflow: WorkflowState): boolean {
  return Object.values(workflow.phases).every((phase) => phase.status === 'closed');
}
