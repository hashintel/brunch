import { bold, h1, h2, h3, ul } from 'md-pen';

import type { EntitiesData, ReviewStatus, WorkflowState } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

export interface ReviewedExportItem {
  content: string;
  rationale?: string | null;
}

export interface ReviewedExportSection {
  heading: string;
  items: ReviewedExportItem[];
}

export interface ReviewedExportProjection {
  caveats: string[];
  sections: ReviewedExportSection[];
}

function renderItem(item: ReviewedExportItem): string {
  const parts = [item.content];
  if (item.rationale) {
    parts.push(`— ${item.rationale}`);
  }
  return parts.join(' ');
}

function getReviewedExportItems(
  items: Array<{ content: string; rationale?: string | null; reviewStatus?: ReviewStatus }>,
) {
  return items.filter((item) => !('reviewStatus' in item) || item.reviewStatus === 'approved');
}

function getReviewedExportCaveats(workflow: WorkflowState): string[] {
  const caveats: string[] = [];
  for (const [phase, state] of Object.entries(workflow.phases)) {
    if (state.closureBasis && state.closureBasis !== 'interviewer_recommended') {
      caveats.push(`${phase} was closed via user-forced closure`);
    }
    if (state.readiness === 'low') {
      caveats.push(`${phase} was closed with low readiness`);
    }
  }
  return caveats;
}

function renderCaveats(caveats: string[]): string {
  if (caveats.length === 0) return '';
  return `${h3('Closure Caveats')}\n\n${ul(caveats.map((caveat) => bold(caveat.split(' ')[0]!) + caveat.slice(caveat.indexOf(' '))))}\n`;
}

export function buildReviewedExportProjection(
  entities: EntitiesData,
  workflow: WorkflowState,
): ReviewedExportProjection {
  return {
    caveats: getReviewedExportCaveats(workflow),
    sections: knowledgeKindRegistry.flatMap((entry) => {
      const items = getReviewedExportItems(entities[entry.collectionKey]).map((item) => ({
        content: item.content,
        rationale: item.rationale,
      }));

      return items.length > 0
        ? [
            {
              heading: entry.label,
              items,
            } satisfies ReviewedExportSection,
          ]
        : [];
    }),
  };
}

export function renderExportMarkdown(
  projectName: string,
  entities: EntitiesData,
  workflow: WorkflowState,
): string {
  const sections: string[] = [h1(projectName), ''];
  const projection = buildReviewedExportProjection(entities, workflow);

  const caveatSection = renderCaveats(projection.caveats);
  if (caveatSection) {
    sections.push(caveatSection);
  }

  for (const section of projection.sections) {
    sections.push(h2(section.heading));
    sections.push('');
    sections.push(ul(section.items.map(renderItem)));
    sections.push('');
  }

  return sections.join('\n');
}

export function isExportReady(workflow: WorkflowState): boolean {
  return Object.values(workflow.phases).every((phase) => phase.status === 'closed');
}
