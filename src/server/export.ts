import { h1, h2, ul } from 'md-pen';

import type { EntitiesData, WorkflowState } from '@/shared/api-types.js';
import { getWorkflowPhaseLabel, phaseOrder } from '@/shared/phase-descriptors.js';

export interface ReviewedExportItem {
  label?: string;
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
  const parts = [item.label ? `${item.label}: ${item.content}` : item.content];
  if (item.rationale) {
    parts.push(`— ${item.rationale}`);
  }
  return parts.join(' ');
}

type ReviewedExportCollectionKey = Exclude<keyof EntitiesData, 'relationships'>;

interface ReviewedExportCollectionDescriptor {
  collectionKey: ReviewedExportCollectionKey;
  label?: string;
}

function getReviewedExportItems(
  entities: EntitiesData,
  collections: readonly ReviewedExportCollectionDescriptor[],
): ReviewedExportItem[] {
  return collections.flatMap(({ collectionKey, label }) =>
    (entities[collectionKey] as Array<{ content: string; rationale?: string | null }>).map((item) => ({
      label,
      content: item.content,
      rationale: item.rationale,
    })),
  );
}

function getReviewedExportCaveats(workflow: WorkflowState): string[] {
  const caveats: string[] = [];
  for (const phase of phaseOrder) {
    const state = workflow.phases[phase];
    const phaseLabel = getWorkflowPhaseLabel(phase);
    if (state.closureBasis && state.closureBasis !== 'interviewer_recommended') {
      caveats.push(`${phaseLabel} was closed manually before the interviewer recommended closure.`);
    }
    if (state.readiness === 'low') {
      caveats.push(`${phaseLabel} was closed while important uncertainty still remained.`);
    }
  }
  return caveats;
}

function renderCaveats(caveats: string[]): string {
  if (caveats.length === 0) return '';
  return `${h2('Closure Caveats')}\n\n${ul(caveats)}\n`;
}

const reviewedExportSectionDescriptors = [
  {
    heading: 'Requirements',
    collections: [{ collectionKey: 'requirements' }],
  },
  {
    heading: 'Acceptance Criteria',
    collections: [{ collectionKey: 'criteria' }],
  },
  {
    heading: 'Supporting Context',
    collections: [
      { collectionKey: 'goals', label: 'Goal' },
      { collectionKey: 'terms', label: 'Term' },
      { collectionKey: 'contexts', label: 'Context' },
      { collectionKey: 'constraints', label: 'Constraint' },
    ],
  },
  {
    heading: 'Design Notes',
    collections: [
      { collectionKey: 'decisions', label: 'Decision' },
      { collectionKey: 'assumptions', label: 'Assumption' },
    ],
  },
] satisfies readonly {
  heading: string;
  collections: readonly ReviewedExportCollectionDescriptor[];
}[];

function buildReviewedExportSection(
  entities: EntitiesData,
  descriptor: (typeof reviewedExportSectionDescriptors)[number],
): ReviewedExportSection | null {
  const items = getReviewedExportItems(entities, descriptor.collections);
  if (items.length === 0) {
    return null;
  }

  return {
    heading: descriptor.heading,
    items,
  };
}

export function buildReviewedExportProjection(
  entities: EntitiesData,
  workflow: WorkflowState,
): ReviewedExportProjection {
  return {
    caveats: getReviewedExportCaveats(workflow),
    sections: reviewedExportSectionDescriptors.flatMap((descriptor) => {
      const section = buildReviewedExportSection(entities, descriptor);
      return section ? [section] : [];
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

  for (const section of projection.sections) {
    sections.push(h2(section.heading));
    sections.push('');
    sections.push(ul(section.items.map(renderItem)));
    sections.push('');
  }

  const caveatSection = renderCaveats(projection.caveats);
  if (caveatSection) {
    sections.push(caveatSection);
  }

  return sections.join('\n');
}

export function isExportReady(workflow: WorkflowState): boolean {
  return Object.values(workflow.phases).every((phase) => phase.status === 'closed');
}
